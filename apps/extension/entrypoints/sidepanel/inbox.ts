import { panelInboxSchema, type FormSnapshot } from '@form-saathi/contracts';

// The panel's decision about every runtime message it receives. Pure, so the
// rules that keep another tab's page or a stale document out of a review can
// be tested without a browser.

export type InboxSender = { id?: string | undefined; tab?: { id?: number | undefined } | undefined };

export type InboxExpectation = {
  runtimeId: string;
  tabId: number;
  /** The document this panel is reviewing, or null when it has none. */
  documentId: string | null;
  /** The newest sequence already accepted for that document. */
  sequence: number | null;
};

export type InboxDecision =
  | { kind: 'ignore'; reason: 'not-ours' | 'malformed' | 'other-tab' | 'other-document' | 'older' | 'from-page' }
  | { kind: 'reread' }
  | { kind: 'snapshot'; snapshot: FormSnapshot };

export function decideInbox(message: unknown, sender: InboxSender, expected: InboxExpectation): InboxDecision {
  if (sender.id !== expected.runtimeId) return { kind: 'ignore', reason: 'not-ours' };
  const parsed = panelInboxSchema.safeParse(message);
  if (!parsed.success) return { kind: 'ignore', reason: 'malformed' };
  if (parsed.data.type === 'activated') {
    // Only the worker sends this; a page cannot ask for a re-read.
    if (sender.tab !== undefined) return { kind: 'ignore', reason: 'from-page' };
    return parsed.data.tabId === expected.tabId ? { kind: 'reread' } : { kind: 'ignore', reason: 'other-tab' };
  }
  const { snapshot } = parsed.data;
  // Chrome fills in the sender, so another tab's reader cannot land here.
  if (sender.tab?.id !== expected.tabId || snapshot.tabId !== expected.tabId) return { kind: 'ignore', reason: 'other-tab' };
  if (expected.documentId === null || snapshot.documentId !== expected.documentId) return { kind: 'ignore', reason: 'other-document' };
  if (expected.sequence !== null && snapshot.sequence <= expected.sequence) return { kind: 'ignore', reason: 'older' };
  return { kind: 'snapshot', snapshot };
}
