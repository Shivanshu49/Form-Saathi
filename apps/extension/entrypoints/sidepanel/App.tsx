import { useEffect, useMemo, useRef, useState } from 'react';
import { healthResponseSchema, type FormField, type FormSnapshot, type Translator, localeNames } from '@form-saathi/contracts';
import {
  acknowledgmentState,
  recognizePage,
  reviewRevision,
  selectRulePack,
  shortRevision,
  summarizeReview,
  validateSnapshot,
  type RulePack,
} from '@form-saathi/rules';
import { API_ORIGIN } from '../../config';
import { loadSession, saveSession, type Session } from './api';
import { fieldValue, metaText, spokenText } from './fields';
import { relocate } from './relocate';
import { Review, spokenReview, type AckState } from './Review';
import { CloudHelp, ServiceAccess, SpeechAssist } from './SpeechAssist';
import { LanguageSelect, useLocale } from '../../../../packages/ui/Locale';
import { Icon } from '../../../../packages/ui/Icon';
import { panelTabId, useFormReader, type Connection } from './useFormReader';

// The panel document is opened for one tab and stays with it.
const tabId = panelTabId();

type Selection = { fieldId: string | null; revealed: ReadonlySet<string> };
const NOTHING_SELECTED: Selection = { fieldId: null, revealed: new Set() };

function connectionText(connection: Connection, t: Translator): string {
  if (connection.state !== 'ready') return t(`status.${connection.state}`);
  const { fields, gaps } = connection.snapshot;
  if (fields.length === 0 && gaps.length === 0) return t('status.empty');
  return [t('status.read', { count: fields.length }), gaps.length ? t('status.gaps', { count: gaps.length }) : ''].filter(Boolean).join(' ');
}

/** Keeps the page's own section order; fields without a legend go last. */
function groupFields(fields: FormField[]): [string, FormField[]][] {
  const groups = new Map<string, FormField[]>();
  for (const field of fields) {
    const existing = groups.get(field.group);
    if (existing) existing.push(field);
    else groups.set(field.group, [field]);
  }
  return [...groups];
}

function FieldValue({ field, revealed }: { field: FormField; revealed: boolean }) {
  const { t } = useLocale();
  const { prefix, value } = fieldValue(field, revealed, t);
  return (
    <p>
      {prefix}
      {value === null ? null : <> <bdi lang={field.lang || undefined}>{value}</bdi></>}
    </p>
  );
}

function packFor(snapshot: FormSnapshot): RulePack | null {
  return selectRulePack(snapshot.origin, snapshot.fields.map((field) => field.key)).pack;
}

/** Exactly what an acknowledgment refers to: data, structure, rules and reference. */
function revisionOf(snapshot: FormSnapshot, reference: string): string {
  const pack = packFor(snapshot);
  return reviewRevision({
    documentId: snapshot.documentId,
    fields: snapshot.fields,
    gaps: snapshot.gaps,
    pack: pack ? { id: pack.id, version: pack.version, reviewed: pack.reviewed } : null,
    reference,
  });
}

export default function App() {
  const { locale, t } = useLocale();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settingsHeading = useRef<HTMLHeadingElement>(null);
  const staleNotice = t('review.stale');
  const { connection, read, rescan, focusField } = useFormReader(tabId);
  const [selection, setSelection] = useState<Selection>(NOTHING_SELECTED);
  const [reference, setReference] = useState('');
  const [announcement, setAnnouncement] = useState<{ situation: string; revision: string; text: string; locale: string } | null>(null);
  // The acknowledgment names the revision it was given for; anything else is stale.
  const [ack, setAck] = useState<{ documentId: string; revision: string; at: string } | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [service, setService] = useState<'idle' | 'checking' | 'ready' | 'unavailable'>('idle');
  const [session, setSession] = useState<Session>({ token: '', consent: false });
  // The document whose reference, acknowledgment, selection, revealed values
  // and announcement are currently held, with the last field list seen of it.
  const [owned, setOwned] = useState<{ documentId: string | null; fields: FormField[] }>({ documentId: null, fields: [] });

  // Stop speaking if the panel goes away; nothing may talk over a screen reader.
  useEffect(() => () => { if ('tts' in chrome) chrome.tts.stop(); }, []);
  // The credential and consent live in the browser's session area only.
  useEffect(() => { void loadSession().then((stored) => setSession(stored)); }, []);

  useEffect(() => { if ('tts' in chrome) chrome.tts.stop(); }, [locale]);
  useEffect(() => { if (settingsOpen) settingsHeading.current?.focus(); }, [settingsOpen]);

  const snapshot = connection.state === 'ready' ? connection.snapshot : null;
  const fields = snapshot?.fields ?? [];
  // A new page, document or field count is a new situation, so the status line
  // returns to describing the page instead of repeating an old announcement.
  const situation = snapshot ? `${snapshot.documentId}:${fields.length}` : connection.state;
  const revision = snapshot ? revisionOf(snapshot, reference) : '';

  // Everything document-owned ends with its document. State is adjusted during
  // render, React's way of reacting to a changed input, so no render commits
  // and no delayed callback can revive a reference, acknowledgment, selection,
  // revealed value or announcement that belonged to an earlier document.
  const ended = connection.state === 'stale' || connection.state === 'closed';
  if ((ended && owned.documentId !== null) || (snapshot !== null && snapshot.documentId !== owned.documentId)) {
    setOwned({ documentId: snapshot?.documentId ?? null, fields });
    setSelection(NOTHING_SELECTED);
    setReference('');
    setAck(null);
    setAnnouncement(null);
  } else if (snapshot !== null && fields !== owned.fields) {
    setOwned({ documentId: snapshot.documentId, fields });
    if (selection.fieldId !== null && !fields.some((field) => field.fieldId === selection.fieldId)) {
      // The page replaced or removed the current control. Its stand-in is
      // taken only when unambiguous; otherwise the person is told and chooses.
      const moved = relocate(owned.fields, selection.fieldId, fields);
      const revealed = new Set([...selection.revealed]
        .map((fieldId) => (fieldId === selection.fieldId ? moved.fieldId ?? fieldId : fieldId))
        .filter((fieldId) => fields.some((field) => field.fieldId === fieldId)));
      setSelection({ fieldId: moved.fieldId, revealed });
      if (moved.fieldId === null) {
        const stale = acknowledgmentState(ack, { documentId: snapshot.documentId, revision }) === 'stale';
        setAnnouncement({ situation, revision, locale, text: `${t(`field.${moved.reason}`)}${stale ? ` ${staleNotice}` : ''}` });
      }
    }
  }

  const currentIndex = Math.max(0, fields.findIndex((field) => field.fieldId === selection.fieldId));
  const current = fields[currentIndex] ?? null;
  const page = snapshot ? recognizePage(snapshot.origin) : null;
  const results = useMemo(() => (snapshot === null ? [] : validateSnapshot({
    locale,
    origin: snapshot.origin,
    fields: snapshot.fields,
    gaps: snapshot.gaps,
    reference: { englishName: reference },
  })), [locale, reference, snapshot]);
  const currentResults = results.filter((result) => result.fieldId === current?.fieldId);
  const pack = snapshot ? packFor(snapshot) : null;
  const ackState: AckState = acknowledgmentState(ack, snapshot === null ? null : { documentId: snapshot.documentId, revision });
  const summary = summarizeReview(results, fields, snapshot?.gaps ?? []);
  const issues = results
    .filter((result) => result.fieldId !== null && result.severity !== 'unchecked')
    .sort((left, right) => fields.findIndex((field) => field.fieldId === left.fieldId)
      - fields.findIndex((field) => field.fieldId === right.fieldId));
  // A change that makes an acknowledgment stale is said once, until the next action.
  const statusLine = ackState === 'stale' && announcement?.revision !== revision
    ? staleNotice
    : announcement?.situation === situation && announcement.locale === locale ? announcement.text : connectionText(connection, t);

  // What is on screen now, for callbacks that finish after the page has moved on.
  const live = useRef({ situation, revision, locale });
  useEffect(() => { live.current = { situation, revision, locale }; });

  function updateSession(next: Session) {
    setSession(next);
    void saveSession(next);
  }

  function announce(text: string) {
    // A message about an earlier page state is dropped, not kept out of sight.
    if (live.current.situation !== situation || live.current.locale !== locale) return;
    setAnnouncement({ situation, revision, locale, text });
  }

  function nextIssue() {
    if (issues.length === 0) {
      announce(t('review.none'));
      return;
    }
    const positions = issues.map((issue) => fields.findIndex((field) => field.fieldId === issue.fieldId));
    const pick = Math.max(0, positions.findIndex((position) => position > currentIndex));
    const issue = issues[pick]!;
    setCurrent(issue.fieldId ?? '');
    announce(t('review.issue', { current: pick + 1, total: issues.length, message: issue.message }));
  }

  // The form is read again first, so the acknowledgment can only ever refer
  // to what is on the page at that moment — including values a script set.
  async function acknowledge() {
    if (snapshot === null || acknowledging) return;
    const displayed = revision;
    setAcknowledging(true);
    const fresh = await rescan();
    setAcknowledging(false);
    if (fresh === null) {
      announce(t('review.failed'));
      return;
    }
    const current = revisionOf(fresh, reference);
    if (current !== displayed) {
      announce(t('review.changed'));
      return;
    }
    setAck({ documentId: fresh.documentId, revision: current, at: new Date().toISOString() });
    announce(t('review.recorded'));
  }

  function setCurrent(fieldId: string, revealed: ReadonlySet<string> = selection.revealed) {
    if (!snapshot) return;
    setSelection({ fieldId, revealed });
  }

  function move(delta: number) {
    const next = currentIndex + delta;
    if (fields.length === 0) return;
    if (next < 0 || next >= fields.length) {
      announce(next < 0 ? t('field.first') : t('field.last'));
      return;
    }
    const field = fields[next]!;
    setCurrent(field.fieldId);
    announce(`${t('field.position', { current: next + 1, total: fields.length })}: ${field.label || t('field.unlabelled')}. ${metaText(field, t)}`);
  }

  function goToFieldId(fieldId: string) {
    const field = fields.find((candidate) => candidate.fieldId === fieldId);
    if (field) goToField(field);
  }

  async function goToField(field: FormField) {
    setCurrent(field.fieldId);
    announce(t('field.focus', { label: field.label || t('field.unlabelled') }));
    const outcome = await focusField(field.fieldId);
    if (outcome.focused || outcome.fresh === null) return;
    // The control was replaced while the request was on its way: aim once
    // more, at its unambiguous stand-in only, never at a guess.
    const moved = relocate(fields, field.fieldId, outcome.fresh.fields);
    if (moved.fieldId !== null) await focusField(moved.fieldId);
  }

  function toggleReveal(field: FormField) {
    const revealed = new Set(selection.revealed);
    const showing = !revealed.delete(field.fieldId);
    if (showing) revealed.add(field.fieldId);
    setCurrent(selection.fieldId ?? field.fieldId, revealed);
    announce(showing ? t('field.revealed', { label: field.label || t('field.unlabelled') }) : t('field.hidden'));
  }

  // Anything spoken here may contain personal values, so only a voice that runs
  // on this machine is used: a remote voice would send the text to a service.
  async function speakLocally(text: string): Promise<boolean> {
    if (!('tts' in chrome)) {
      announce(t('speech.noLocal', { language: localeNames[locale] }));
      return false;
    }
    const voices = await chrome.tts.getVoices();
    if (live.current.locale !== locale || live.current.situation !== situation) return false;
    const local = voices.find((voice) => voice.remote === false && (voice.lang ?? '').toLowerCase().split('-')[0] === locale);
    if (!local) {
      announce(t('speech.noLocal', { language: localeNames[locale] }));
      return false;
    }
    chrome.tts.stop();
    void chrome.tts.speak(text, { voiceName: local.voiceName ?? '', lang: local.lang ?? locale, rate: 1 });
    return true;
  }

  async function speak(field: FormField) {
    if (await speakLocally(spokenText(field, selection.revealed.has(field.fieldId), t))) announce(t('speech.speaking'));
  }

  async function speakReview() {
    if (await speakLocally(spokenReview(summary, ackState, issues, t))) announce(t('speech.speaking'));
  }

  function stopSpeaking() {
    if ('tts' in chrome) chrome.tts.stop();
    announce(t('speech.stopped'));
  }

  async function checkService() {
    if (service === 'checking') return;
    setService('checking');
    try {
      const response = await fetch(`${API_ORIGIN}/health`, {
        signal: AbortSignal.timeout(5_000),
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Service unavailable');
      healthResponseSchema.parse(await response.json());
      setService('ready');
    } catch {
      setService('unavailable');
    }
  }

  return (
    <main className="panel">
      <header className="panel-header">
        <h1 className="brand"><Icon name="mark" />{t('app.name')}</h1>
        <div className="header-controls">
          <LanguageSelect />
          <button ref={settingsButton} type="button" aria-expanded={settingsOpen} aria-controls="settings" onClick={() => setSettingsOpen(!settingsOpen)} className="button compact"><Icon name="settings" />{t('settings')}</button>
        </div>
      </header>

      <section id="settings" hidden={!settingsOpen} aria-labelledby="settings-heading" className="settings stack">
        <div className="section-heading"><h2 id="settings-heading" ref={settingsHeading} tabIndex={-1}>{t('settings')}</h2><button type="button" className="button" onClick={() => { setSettingsOpen(false); settingsButton.current?.focus(); }}>{t('settings.close')}</button></div>
        <ServiceAccess session={session} onSession={updateSession} />
        <p>{t('speech.localOnly')}</p>
        <CloudHelp key={`${snapshot?.documentId ?? connection.state}:${locale}`} session={session} announce={announce} />
        <section aria-labelledby="service-heading" className="stack">
          <h3 id="service-heading">{t('service.check')}</h3><p id="service-help">{t('service.help')}</p>
          <button type="button" className="button" onClick={checkService} aria-disabled={service === 'checking'} aria-describedby="service-help">{t('service.check')}</button>
          <p id="service-status" aria-live="polite" aria-atomic="true">{t(`service.${service}`)}</p>
        </section>
      </section>

      <section aria-labelledby="page-heading" className="form-status stack">
        <div className="section-heading"><h2 id="page-heading">{t('status.heading')}</h2>
          {tabId === null ? null : <button type="button" onClick={() => { if (connection.state !== 'reading') read(); }} aria-disabled={connection.state === 'reading'} className="button compact"><Icon name="refresh" />{t('rescan')}</button>}
        </div>
        {snapshot ? <p className="page-title"><bdi lang={snapshot.title ? snapshot.lang || undefined : locale}>{snapshot.title || t('untitled')}</bdi></p> : null}
        <output aria-live="polite" aria-atomic="true">{statusLine}</output>
        {snapshot ? <>
          <p className="muted">{t(pack ? 'support.pack' : 'support.unknown')}</p>
          <details><summary>{t('support.details')}</summary><div className="stack detail-body">
            <bdi dir="ltr" className="technical">{snapshot.origin}</bdi>
            <p>{page?.kind === 'portal' ? t(`workflow.${page.workflow}`) : t(page?.kind === 'local' ? 'support.local' : 'support.unknown')}</p>
            <p>{t('support.none')}</p><p>{t('support.unverified')}</p>
          </div></details>
        </> : null}
      </section>

      {current ? <section aria-labelledby="current-heading" className="current-field stack">
        <div className="section-heading"><h2 id="current-heading">{t('field.current')}</h2><span className="muted">{t('field.position', { current: currentIndex + 1, total: fields.length })}</span></div>
        <p className="eyebrow"><bdi lang={current.group ? current.groupLang || current.lang || undefined : locale}>{current.group || t('field.other')}</bdi></p>
        <h3 className="field-label"><bdi lang={current.label ? current.labelLang || current.lang || undefined : locale}>{current.label || t('field.unlabelled')}</bdi></h3>
        <p className="muted">{metaText(current, t)}</p>
        <div className="field-value"><FieldValue field={current} revealed={selection.revealed.has(current.fieldId)} />
          {fieldValue(current, selection.revealed.has(current.fieldId), t).maskable ? <button type="button" className="button compact" onClick={() => toggleReveal(current)}>{t(selection.revealed.has(current.fieldId) ? 'field.hide' : 'field.reveal')}</button> : null}
        </div>
        {current.description ? <div className="source-text"><p className="eyebrow">{t('field.source')}</p><p dir="auto">{current.instructions?.length ? current.instructions.map((part, index) => <span key={index} lang={part.lang || undefined}>{part.text}</span>) : <span lang={current.lang || undefined}>{current.description}</span>}</p></div> : null}
        {current.constraints.pattern === null ? null : <p className="small">{t('field.pattern')} <bdi dir="ltr">{current.constraints.pattern}</bdi></p>}
        {currentResults.length ? <ul className="issue-list">{currentResults.map((result, index) => <li key={`${result.ruleId}-${index}`} className={`issue ${result.severity}`}><strong>{t(`severity.${result.severity}`)}</strong><p dir="auto">{result.message}</p><p className="small">{t('nextAction')} {result.action}</p></li>)}</ul> : null}
        <div className="field-navigation">
          <button type="button" onClick={() => move(-1)} aria-disabled={currentIndex === 0} className="button">{t('field.previous')}</button>
          <button type="button" onClick={() => move(1)} aria-disabled={currentIndex >= fields.length - 1} className="button">{t('field.next')}</button>
          <button type="button" onClick={() => void goToField(current)} className="button primary go-field">{t('field.go')}<Icon name="arrow" className="directional" /></button>
        </div>
        <div className="actions"><button type="button" className="button compact" onClick={() => void speak(current)}>{t('speech.read')}</button><button type="button" className="button compact" onClick={stopSpeaking}>{t('speech.stop')}</button></div>
        <p className="small muted">{t('field.return')}</p>
      </section> : null}

      {current && snapshot ? <SpeechAssist key={`${snapshot.documentId}:${current.fieldId}:${locale}`} field={current} snapshot={snapshot} reference={reference} pack={pack} session={session} onGoToField={(field) => void goToField(field)} announce={announce} /> : null}

      {snapshot ? <>
        <Review snapshot={snapshot} results={results} summary={summary} issues={issues} pack={pack} revealed={selection.revealed} ackState={ackState}
          ackLabel={ack === null ? null : t('review.revision', { revision: shortRevision(ack.revision), time: new Date(ack.at).toLocaleTimeString(locale) })}
          acknowledging={acknowledging} onAcknowledge={() => void acknowledge()} onGoToField={goToFieldId} onNextIssue={nextIssue} onSpeak={() => void speakReview()} onStop={stopSpeaking} />
        <details className="reference"><summary>{t('reference.heading')}</summary><div className="stack detail-body">
          <label htmlFor="reference-name">{t('reference.label')}</label>
          <input id="reference-name" type="text" value={reference} lang="en" dir="ltr" autoComplete="off" spellCheck={false} onChange={(event) => setReference(event.target.value)} aria-describedby="reference-help" />
          <p id="reference-help" className="small">{t('reference.help')}</p>
        </div></details>
      </> : null}

      {snapshot && fields.length ? <details className="fields-disclosure"><summary>{t('field.list')} ({fields.length})</summary>
        <section aria-labelledby="fields-heading" className="stack detail-body"><h2 id="fields-heading">{t('field.list')}</h2><p className="small">{t('field.listHelp')}</p>
          {groupFields(fields).map(([group, list], index) => <section key={group} aria-labelledby={`group-${index}`} className="stack"><h3 id={`group-${index}`} lang={group ? list[0]?.groupLang || list[0]?.lang || undefined : locale}>{group || t('field.other')}</h3><ul className="field-list">{list.map((field) => <li key={field.fieldId}>
            <button type="button" className="button field-link" onClick={() => void goToField(field)} aria-current={field.fieldId === current?.fieldId ? 'true' : undefined} lang={field.label ? field.labelLang || field.lang || undefined : locale} dir="auto">{field.label || t('field.unlabelled')}</button>
            <p className="small muted">{metaText(field, t)}</p><FieldValue field={field} revealed={selection.revealed.has(field.fieldId)} />
          </li>)}</ul></section>)}
        </section>
      </details> : null}
      <details className="privacy"><summary>{t('privacy.heading')}</summary><div className="stack detail-body"><p>{t('privacy.local')}</p><p>{t('speech.localOnly')}</p><p>{t('review.manual')}</p></div></details>
    </main>
  );
}
