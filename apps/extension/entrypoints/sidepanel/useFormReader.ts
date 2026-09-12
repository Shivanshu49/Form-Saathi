import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readerReplySchema,
  type FormSnapshot,
  type ReaderRequest,
} from '@form-saathi/contracts';
import { decideInbox } from './inbox';

export type Connection =
  /** No tab in the panel URL: the panel was opened without activating a page. */
  | { state: 'unbound' }
  | { state: 'reading' }
  /** The page cannot be injected into: a browser page, or not activated here. */
  | { state: 'unsupported' }
  /** Injected, but the reader did not answer usably. */
  | { state: 'error' }
  /** The tab this review belonged to is gone. */
  | { state: 'closed' }
  /** The page reloaded or navigated, so the review no longer describes it. */
  | { state: 'stale' }
  | { state: 'ready'; snapshot: FormSnapshot };

/**
 * The background opens one panel document per tab, with that tab in the URL, so
 * a review can never be shown beside another tab's page.
 */
export function panelTabId(): number | null {
  const requested = new URLSearchParams(location.search).get('tab');
  // A missing or malformed tab leaves the panel unbound; it must never guess one.
  return requested !== null && /^\d+$/.test(requested) ? Number(requested) : null;
}

export function useFormReader(tabId: number | null) {
  const [connection, setConnection] = useState<Connection>(
    tabId === null ? { state: 'unbound' } : { state: 'reading' },
  );
  // The document instance this review belongs to; cleared whenever it is gone.
  const documentId = useRef<string | null>(null);
  // The newest snapshot accepted, so an older push can be recognised.
  const latest = useRef<FormSnapshot | null>(null);

  /** Injects if needed and reads the form now. Returns what was read, or null. */
  const connect = useCallback(async (): Promise<FormSnapshot | null> => {
    if (tabId === null) return null;
    documentId.current = null;
    try {
      // Needs the activeTab grant from the toolbar button. Injecting again is
      // how repeated activation and a disconnected reader both recover.
      await chrome.scripting.executeScript({ target: { tabId }, files: ['reader.js'] });
    } catch {
      setConnection({ state: 'unsupported' });
      return null;
    }
    try {
      const reply = readerReplySchema.parse(
        await chrome.tabs.sendMessage(tabId, { type: 'scan', tabId } satisfies ReaderRequest),
      );
      if (reply.type !== 'snapshot' || reply.snapshot.tabId !== tabId) throw new Error('Unusable reply');
      documentId.current = reply.snapshot.documentId;
      latest.current = reply.snapshot;
      setConnection({ state: 'ready', snapshot: reply.snapshot });
      return reply.snapshot;
    } catch {
      setConnection({ state: 'error' });
      return null;
    }
  }, [tabId]);

  /** The user asked for a re-read, so report progress before reconnecting. */
  const read = useCallback(() => {
    setConnection({ state: 'reading' });
    void connect();
  }, [connect]);

  const focusField = useCallback(async (fieldId: string) => {
    if (tabId === null || documentId.current === null) return;
    try {
      const reply = readerReplySchema.parse(await chrome.tabs.sendMessage(tabId, {
        type: 'focus', tabId, documentId: documentId.current, fieldId,
      } satisfies ReaderRequest));
      // The field moved or the page changed underneath: read the form again.
      if (reply.type !== 'focus-result' || reply.result !== 'focused') await connect();
    } catch {
      documentId.current = null;
      setConnection({ state: 'error' });
    }
  }, [connect, tabId]);

  // Connecting to the tab's content script is exactly the external system an
  // effect is for; every state change below happens after an await.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void connect(); }, [connect]);

  useEffect(() => {
    if (tabId === null) return;
    const onMessage = (message: unknown, sender: chrome.runtime.MessageSender) => {
      const decision = decideInbox(message, sender, {
        runtimeId: chrome.runtime.id,
        tabId,
        documentId: documentId.current,
        sequence: latest.current?.documentId === documentId.current ? latest.current.sequence : null,
      });
      if (decision.kind === 'reread') void connect();
      if (decision.kind !== 'snapshot') return;
      latest.current = decision.snapshot;
      setConnection({ state: 'ready', snapshot: decision.snapshot });
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [connect, tabId]);

  useEffect(() => {
    if (tabId === null) return;
    const onRemoved = (closed: number) => {
      if (closed !== tabId) return;
      documentId.current = null;
      setConnection({ state: 'closed' });
    };
    const onUpdated = (updated: number, change: chrome.tabs.OnUpdatedInfo) => {
      if (updated !== tabId || change.status !== 'loading') return;
      // Reload or navigation: drop the values read from the previous document.
      documentId.current = null;
      setConnection({ state: 'stale' });
    };
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onRemoved.removeListener(onRemoved);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [tabId]);

  // `rescan` reads again without a loading state, so nothing on screen moves.
  return { connection, read, rescan: connect, focusField };
}
