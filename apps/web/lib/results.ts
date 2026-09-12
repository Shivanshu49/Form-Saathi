import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resultsFileSchema, summarize, type ConditionSummary, type Session } from '../../../studies/report';

// The results page reads the same files, through the same schema, as the
// report generator. It cannot show anything that was not actually filed.

export type ResultsData =
  | { state: 'empty'; files: number }
  | { state: 'invalid'; file: string; problems: string[] }
  | { state: 'loaded'; files: number; sessions: Session[]; summary: ConditionSummary[] };

export function loadResults(directory = resolve(process.cwd(), '../../studies/results')): ResultsData {
  let names: string[];
  try {
    names = readdirSync(directory).filter((name) => name.endsWith('.json')).sort();
  } catch {
    return { state: 'empty', files: 0 };
  }
  const sessions: Session[] = [];
  for (const name of names) {
    const parsed = resultsFileSchema.safeParse(JSON.parse(readFileSync(join(directory, name), 'utf8')));
    if (!parsed.success) {
      return {
        state: 'invalid',
        file: name,
        problems: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).slice(0, 10),
      };
    }
    sessions.push(...parsed.data.sessions);
  }
  if (sessions.length === 0) return { state: 'empty', files: names.length };
  return { state: 'loaded', files: names.length, sessions, summary: summarize(sessions) };
}
