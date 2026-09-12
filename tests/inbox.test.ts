import { describe, expect, it } from 'vitest';
import type { FormSnapshot } from '@form-saathi/contracts';
import { decideInbox } from '../apps/extension/entrypoints/sidepanel/inbox.js';

// Tab isolation and stale-response rejection as pure decisions.

const RUNTIME = 'extension-id';
const expected = { runtimeId: RUNTIME, tabId: 7, documentId: 'doc-1', sequence: 3 };

function snapshot(overrides: Partial<FormSnapshot> = {}): FormSnapshot {
  return { tabId: 7, documentId: 'doc-1', sequence: 4, origin: 'http://127.0.0.1:4173', title: 'NSP', fields: [], gaps: [], ...overrides };
}

const fromTab = (id: number) => ({ id: RUNTIME, tab: { id } });
const fromWorker = { id: RUNTIME };

describe('panel inbox', () => {
  it('accepts a newer snapshot from its own tab and document', () => {
    const decision = decideInbox({ type: 'snapshot', snapshot: snapshot() }, fromTab(7), expected);
    expect(decision.kind).toBe('snapshot');
  });

  it('rejects another tab, whatever the payload claims', () => {
    expect(decideInbox({ type: 'snapshot', snapshot: snapshot() }, fromTab(8), expected)).toEqual({ kind: 'ignore', reason: 'other-tab' });
    expect(decideInbox({ type: 'snapshot', snapshot: snapshot({ tabId: 8 }) }, fromTab(7), expected)).toEqual({ kind: 'ignore', reason: 'other-tab' });
  });

  it('rejects a stale document and an older or repeated sequence', () => {
    expect(decideInbox({ type: 'snapshot', snapshot: snapshot({ documentId: 'doc-0' }) }, fromTab(7), expected))
      .toEqual({ kind: 'ignore', reason: 'other-document' });
    expect(decideInbox({ type: 'snapshot', snapshot: snapshot() }, fromTab(7), { ...expected, documentId: null }))
      .toEqual({ kind: 'ignore', reason: 'other-document' });
    for (const sequence of [3, 2]) {
      expect(decideInbox({ type: 'snapshot', snapshot: snapshot({ sequence }) }, fromTab(7), expected))
        .toEqual({ kind: 'ignore', reason: 'older' });
    }
  });

  it('rejects other extensions and malformed messages', () => {
    expect(decideInbox({ type: 'snapshot', snapshot: snapshot() }, { id: 'someone-else', tab: { id: 7 } }, expected))
      .toEqual({ kind: 'ignore', reason: 'not-ours' });
    for (const message of [null, {}, { type: 'snapshot' }, { type: 'evaluate', code: 'x' }, { type: 'snapshot', snapshot: { ...snapshot(), fields: 'x' } }]) {
      expect(decideInbox(message, fromTab(7), expected)).toEqual({ kind: 'ignore', reason: 'malformed' });
    }
  });

  it('re-reads only on the worker’s activation for this tab', () => {
    expect(decideInbox({ type: 'activated', tabId: 7 }, fromWorker, expected)).toEqual({ kind: 'reread' });
    expect(decideInbox({ type: 'activated', tabId: 8 }, fromWorker, expected)).toEqual({ kind: 'ignore', reason: 'other-tab' });
    expect(decideInbox({ type: 'activated', tabId: 7 }, fromTab(7), expected)).toEqual({ kind: 'ignore', reason: 'from-page' });
  });
});
