import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

// Aggregates pilot session records into a Markdown report. Records are
// pseudonymous counts and durations only: the schema has no place for a name,
// a field value, a transcript or a recording, and unknown keys are rejected.
// An empty results file produces an empty report, never a placeholder number.

const count = z.number().int().min(0);

export const sessionSchema = z.strictObject({
  /** Pseudonym assigned by the study, never a name or an account. */
  participant: z.string().regex(/^P\d{2,3}$/),
  /** A: NVDA + Gemini in Chrome; B: NVDA + full Form Saathi; C: NVDA + Form Saathi, AI off. */
  condition: z.enum(['A', 'B', 'C']),
  orderPosition: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  workflow: z.enum(['nsp', 'eciForm6']),
  variant: z.enum(['a', 'b']),
  scenario: z.enum(['issues', 'complete']),
  /** From fixtures/expected-results.md for that workflow and scenario. */
  seededIssues: count,
  /** Seeded issues still present when the session ended. */
  remainingErrors: count,
  /** Warnings shown for values that were correct. */
  falseWarnings: count,
  /** Seeded issues the tool never flagged; null where no tool was used (A). */
  missedErrors: count.nullable(),
  taskCompleted: z.boolean(),
  durationSeconds: z.number().int().min(1),
  /** Times a person helped: navigation, explanation or physical help. */
  assistanceEvents: count,
  /** Panel sentences, button names or messages the participant reported unclear, by identifier. */
  unclearWording: count,
  /** Recorded separately; never folded into the error counts. */
  captchaBlockers: count,
  outcome: z.enum(['completed', 'time-limit', 'captcha-blocked', 'technical-failure', 'participant-stopped']),
}).refine((session) => session.remainingErrors <= session.seededIssues, { message: 'remainingErrors exceeds seededIssues' })
  .refine((session) => session.missedErrors === null || session.missedErrors <= session.seededIssues, { message: 'missedErrors exceeds seededIssues' })
  .refine((session) => (session.condition === 'A') === (session.missedErrors === null), { message: 'missedErrors must be null exactly for condition A' })
  .refine((session) => session.taskCompleted === (session.outcome === 'completed'), { message: 'taskCompleted must match outcome' });

export const resultsFileSchema = z.strictObject({
  protocolVersion: z.literal('1.0'),
  sessions: z.array(sessionSchema),
});

export type Session = z.infer<typeof sessionSchema>;

export type ConditionSummary = {
  condition: Session['condition'];
  sessions: number;
  participants: number;
  completed: number;
  meanDurationSeconds: number | null;
  meanRemainingErrors: number | null;
  meanFalseWarnings: number | null;
  meanMissedErrors: number | null;
  assistanceEvents: number;
  unclearWording: number;
  captchaBlockers: number;
  byOrderPosition: Record<1 | 2 | 3, number>;
};

function mean(values: number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function summarize(sessions: readonly Session[]): ConditionSummary[] {
  return (['A', 'B', 'C'] as const).map((condition) => {
    const own = sessions.filter((session) => session.condition === condition);
    const missed = own.map((session) => session.missedErrors).filter((value): value is number => value !== null);
    return {
      condition,
      sessions: own.length,
      participants: new Set(own.map((session) => session.participant)).size,
      completed: own.filter((session) => session.taskCompleted).length,
      meanDurationSeconds: mean(own.map((session) => session.durationSeconds)),
      meanRemainingErrors: mean(own.map((session) => session.remainingErrors)),
      meanFalseWarnings: mean(own.map((session) => session.falseWarnings)),
      meanMissedErrors: mean(missed),
      assistanceEvents: own.reduce((sum, session) => sum + session.assistanceEvents, 0),
      unclearWording: own.reduce((sum, session) => sum + session.unclearWording, 0),
      captchaBlockers: own.reduce((sum, session) => sum + session.captchaBlockers, 0),
      byOrderPosition: {
        1: own.filter((session) => session.orderPosition === 1).length,
        2: own.filter((session) => session.orderPosition === 2).length,
        3: own.filter((session) => session.orderPosition === 3).length,
      },
    };
  });
}

function cell(value: number | null): string {
  return value === null ? '—' : String(value);
}

export function renderReport(sessions: readonly Session[], generatedAt: string): string {
  const lines = [
    '# Form Saathi pilot results',
    '',
    `Generated ${generatedAt} from ${sessions.length} session record(s). Records are pseudonymous`,
    'counts and durations; no field value, transcript or recording is collected.',
    'Small numbers support no general claim; report them as what was observed.',
    '',
  ];
  if (sessions.length === 0) {
    lines.push('**No sessions recorded.** Nothing below is measured yet.', '');
    return lines.join('\n');
  }
  lines.push(
    '| Condition | Sessions | Participants | Completed | Mean duration (s) | Mean remaining errors | Mean false warnings | Mean missed errors | Assistance events | Unclear wording | CAPTCHA blockers (separate) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const row of summarize(sessions)) {
    lines.push(`| ${row.condition} | ${row.sessions} | ${row.participants} | ${row.completed} | ${cell(row.meanDurationSeconds)} | ${cell(row.meanRemainingErrors)} | ${cell(row.meanFalseWarnings)} | ${cell(row.meanMissedErrors)} | ${row.assistanceEvents} | ${row.unclearWording} | ${row.captchaBlockers} |`);
  }
  lines.push('', '## Counterbalancing', '', '| Condition | 1st | 2nd | 3rd |', '| --- | --- | --- | --- |');
  for (const row of summarize(sessions)) {
    lines.push(`| ${row.condition} | ${row.byOrderPosition[1]} | ${row.byOrderPosition[2]} | ${row.byOrderPosition[3]} |`);
  }
  lines.push('', '## Outcomes', '', '| Outcome | Sessions |', '| --- | --- |');
  for (const outcome of ['completed', 'time-limit', 'captcha-blocked', 'technical-failure', 'participant-stopped'] as const) {
    lines.push(`| ${outcome} | ${sessions.filter((session) => session.outcome === outcome).length} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function loadResults(paths: readonly string[]): Session[] {
  return paths.flatMap((path) => {
    const parsed = resultsFileSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    if (!parsed.success) {
      throw new Error(`${path}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
    }
    return parsed.data.sessions;
  });
}

// Usage: node studies/report.ts studies/results/*.json > studies/report.md
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = process.argv.slice(2);
  try {
    console.log(renderReport(loadResults(paths), new Date().toISOString().slice(0, 10)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unreadable results file');
    process.exit(1);
  }
}
