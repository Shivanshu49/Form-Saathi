import { describe, expect, it } from 'vitest';
import { renderReport, resultsFileSchema, sessionSchema, summarize, type Session } from '../studies/report.js';

const session: Session = {
  participant: 'P01',
  condition: 'B',
  orderPosition: 1,
  workflow: 'nsp',
  variant: 'a',
  scenario: 'issues',
  seededIssues: 5,
  remainingErrors: 1,
  falseWarnings: 0,
  missedErrors: 0,
  taskCompleted: true,
  durationSeconds: 600,
  assistanceEvents: 2,
  captchaBlockers: 0,
  outcome: 'completed',
};

describe('pilot session records', () => {
  it('accepts a complete pseudonymous record', () => {
    expect(sessionSchema.safeParse(session).success).toBe(true);
  });

  it('rejects anything that could carry a name, a value or an inconsistent count', () => {
    const bad: unknown[] = [
      { ...session, participant: 'Kavya' },
      { ...session, name: 'KAVYA SAIN' },
      { ...session, enteredValue: '226001' },
      { ...session, notes: 'said 15/08/2004' },
      { ...session, remainingErrors: 6 },
      { ...session, condition: 'A' },
      { ...session, condition: 'A', missedErrors: null, taskCompleted: false },
      { ...session, outcome: 'time-limit' },
    ];
    for (const record of bad) expect(sessionSchema.safeParse(record).success).toBe(false);
    expect(sessionSchema.safeParse({ ...session, condition: 'A', missedErrors: null }).success).toBe(true);
  });

  it('keeps the empty template empty and refuses other protocol versions', () => {
    expect(resultsFileSchema.parse({ protocolVersion: '1.0', sessions: [] })).toEqual({ protocolVersion: '1.0', sessions: [] });
    expect(resultsFileSchema.safeParse({ protocolVersion: '0.9', sessions: [] }).success).toBe(false);
  });
});

describe('pilot report', () => {
  it('prints an empty report for no sessions and invents nothing', () => {
    const report = renderReport([], '2026-09-12');
    expect(report).toContain('No sessions recorded');
    expect(report).not.toMatch(/\| [ABC] \|/);
  });

  it('aggregates per condition, keeping CAPTCHA blockers separate', () => {
    const sessions: Session[] = [
      session,
      { ...session, participant: 'P02', orderPosition: 2, remainingErrors: 3, durationSeconds: 900, captchaBlockers: 1 },
      { ...session, participant: 'P01', condition: 'A', orderPosition: 2, missedErrors: null, remainingErrors: 2, taskCompleted: false, outcome: 'time-limit' },
    ];
    const [a, b, c] = summarize(sessions);
    expect(b).toMatchObject({ sessions: 2, participants: 2, completed: 2, meanDurationSeconds: 750, meanRemainingErrors: 2, meanMissedErrors: 0, captchaBlockers: 1, byOrderPosition: { 1: 1, 2: 1, 3: 0 } });
    expect(a).toMatchObject({ sessions: 1, completed: 0, meanMissedErrors: null, meanRemainingErrors: 2 });
    expect(c).toMatchObject({ sessions: 0, meanDurationSeconds: null });
    const report = renderReport(sessions, '2026-09-12');
    expect(report).toContain('| B | 2 | 2 | 2 | 750 | 2 | 0 | 0 | 4 | 1 |');
    expect(report).toContain('| time-limit | 1 |');
  });
});
