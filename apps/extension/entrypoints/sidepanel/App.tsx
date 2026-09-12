import { useEffect, useMemo, useState } from 'react';
import { healthResponseSchema, type FormField, type FormSnapshot } from '@form-saathi/contracts';
import {
  acknowledgmentState,
  livePortalSupport,
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
import { fieldValue, metaText, noField, spokenText } from './fields';
import { Review, severityText, spokenReview, type AckState } from './Review';
import { CloudHelp, ServiceAccess, SpeechAssist } from './SpeechAssist';
import { panelTabId, useFormReader, type Connection } from './useFormReader';

const supportText = { unverified: 'वास्तविक फ़ॉर्म पर परीक्षण बाकी है।' };
const serviceText = {
  idle: 'सेवा की स्थिति अभी जाँची नहीं गई है।',
  checking: 'सेवा की स्थिति जाँची जा रही है…',
  ready: 'सेवा उपलब्ध है।',
  unavailable: 'सेवा से संपर्क नहीं हो पाया। कुछ देर बाद फिर जाँचें।',
};
const workflowText = {
  nsp: 'NSP — Basic Information → General Information (AY 2026–27)',
  eciForm6: 'ECI Form 6 — नए मतदाता का आवेदन',
};
const returnRoute = 'पेज पर जाने के बाद पैनल पर लौटने के लिए F6 दबाएँ, या Alt+Shift+F से फ़ॉर्म साथी फिर खोलें।';
const staleNotice = 'फ़ॉर्म बदल गया: पिछली स्वीकृति अमान्य है। समीक्षा फिर पढ़ें और फिर स्वीकृति दें।';

const button = 'min-h-12 rounded-md border-2 border-teal-950 px-3 py-2 font-bold hover:bg-stone-200 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-900 aria-disabled:border-stone-500 aria-disabled:text-stone-600';
const primaryButton = 'min-h-12 w-full rounded-md border-2 border-teal-950 bg-teal-900 px-4 py-3 font-bold text-white hover:bg-teal-950 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-900 aria-disabled:cursor-wait';

// The panel document is opened for one tab and stays with it.
const tabId = panelTabId();

type Selection = { documentId: string; fieldId: string | null; revealed: ReadonlySet<string> };
const NOTHING_SELECTED: Selection = { documentId: '', fieldId: null, revealed: new Set() };

function connectionText(connection: Connection): string {
  switch (connection.state) {
    case 'unbound':
      return 'यह पैनल किसी टैब से नहीं जुड़ा है। जिस फ़ॉर्म को पढ़ना है, उस टैब पर टूलबार में फ़ॉर्म साथी का बटन दबाएँ।';
    case 'reading':
      return 'पेज पढ़ा जा रहा है…';
    case 'unsupported':
      return 'यह पेज नहीं पढ़ा जा सकता। उसी टैब पर टूलबार का बटन दबाकर फ़ॉर्म साथी चालू करें। ब्राउज़र के अपने पेज कभी नहीं पढ़े जाते।';
    case 'error':
      return 'पेज से संपर्क टूट गया। फ़ॉर्म फिर पढ़ें।';
    case 'closed':
      return 'जिस टैब की समीक्षा थी वह बंद हो गया। पढ़ी गई जानकारी हटा दी गई है।';
    case 'stale':
      return 'पेज फिर से लोड हुआ। पिछली पढ़ी गई जानकारी हटा दी गई है। फ़ॉर्म फिर पढ़ें।';
    case 'ready': {
      const { fields, gaps } = connection.snapshot;
      if (fields.length === 0 && gaps.length === 0) return 'इस पेज पर कोई समर्थित फ़ील्ड नहीं मिला।';
      const gapNote = gaps.length > 0 ? ` ${gaps.length} जगह नहीं पढ़ी जा सकीं।` : '';
      return `${fields.length} फ़ील्ड पढ़े गए।${gapNote}`;
    }
  }
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
  const { prefix, value } = fieldValue(field, revealed);
  return (
    <p>
      {prefix}
      {value === null ? null : <> <span lang={field.lang || undefined}>{value}</span></>}
    </p>
  );
}

function packFor(snapshot: FormSnapshot): RulePack | null {
  return selectRulePack(snapshot.origin, snapshot.fields.map((field) => field.key))?.pack ?? null;
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
  const { connection, read, rescan, focusField } = useFormReader(tabId);
  const [selection, setSelection] = useState<Selection>(NOTHING_SELECTED);
  const [reference, setReference] = useState('');
  const [announcement, setAnnouncement] = useState<{ situation: string; revision: string; text: string } | null>(null);
  // The acknowledgment names the revision it was given for; anything else is stale.
  const [ack, setAck] = useState<{ documentId: string; revision: string; at: string } | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [service, setService] = useState<keyof typeof serviceText>('idle');
  const [session, setSession] = useState<Session>({ token: '', consent: false });

  // Stop speaking if the panel goes away; nothing may talk over a screen reader.
  useEffect(() => () => { if ('tts' in chrome) chrome.tts.stop(); }, []);
  // The credential and consent live in the browser's session area only.
  useEffect(() => { void loadSession().then((stored) => setSession(stored)); }, []);

  const snapshot = connection.state === 'ready' ? connection.snapshot : null;
  const fields = snapshot?.fields ?? [];
  // A new page, document or field count is a new situation, so the status line
  // returns to describing the page instead of repeating an old announcement.
  const situation = snapshot ? `${snapshot.documentId}:${fields.length}` : connection.state;
  const active = snapshot && selection.documentId === snapshot.documentId ? selection : NOTHING_SELECTED;
  const currentIndex = Math.max(0, fields.findIndex((field) => field.fieldId === active.fieldId));
  const current = fields[currentIndex] ?? null;
  const page = snapshot ? recognizePage(snapshot.origin) : null;
  const results = useMemo(() => (snapshot === null ? [] : validateSnapshot({
    origin: snapshot.origin,
    fields: snapshot.fields,
    gaps: snapshot.gaps,
    reference: { englishName: reference },
  })), [reference, snapshot]);
  const currentResults = results.filter((result) => result.fieldId === current?.fieldId);
  const pack = snapshot ? packFor(snapshot) : null;
  const revision = snapshot ? revisionOf(snapshot, reference) : '';
  const ackState: AckState = acknowledgmentState(ack, snapshot === null ? null : { documentId: snapshot.documentId, revision });
  const summary = summarizeReview(results, fields, snapshot?.gaps ?? []);
  const issues = results
    .filter((result) => result.fieldId !== null && result.severity !== 'unchecked')
    .sort((left, right) => fields.findIndex((field) => field.fieldId === left.fieldId)
      - fields.findIndex((field) => field.fieldId === right.fieldId));
  // A change that makes an acknowledgment stale is said once, until the next action.
  const statusLine = ackState === 'stale' && announcement?.revision !== revision
    ? staleNotice
    : announcement?.situation === situation ? announcement.text : connectionText(connection);

  function updateSession(next: Session) {
    setSession(next);
    void saveSession(next);
  }

  function announce(text: string) {
    setAnnouncement({ situation, revision, text });
  }

  function nextIssue() {
    if (issues.length === 0) {
      announce('कोई खुली समस्या नहीं। जाँचा-नहीं-गया हिस्से समीक्षा में हैं।');
      return;
    }
    const positions = issues.map((issue) => fields.findIndex((field) => field.fieldId === issue.fieldId));
    const pick = Math.max(0, positions.findIndex((position) => position > currentIndex));
    const issue = issues[pick]!;
    setCurrent(issue.fieldId ?? '');
    announce(`समस्या ${pick + 1} / ${issues.length}: ${issue.message}`);
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
      announce('फ़ॉर्म फिर नहीं पढ़ा जा सका, इसलिए स्वीकृति दर्ज नहीं हुई।');
      return;
    }
    const current = revisionOf(fresh, reference);
    if (current !== displayed) {
      announce('फ़ॉर्म बदल गया था; नई समीक्षा देखें और फिर स्वीकृति दें।');
      return;
    }
    setAck({ documentId: fresh.documentId, revision: current, at: new Date().toLocaleTimeString('hi-IN') });
    announce('समीक्षा पढ़ने की स्वीकृति दर्ज हुई। यह पोर्टल की स्वीकृति, पहचान की पुष्टि या आवेदन भेजना नहीं है।');
  }

  function setCurrent(fieldId: string, revealed: ReadonlySet<string> = active.revealed) {
    if (!snapshot) return;
    setSelection({ documentId: snapshot.documentId, fieldId, revealed });
  }

  function move(delta: number) {
    const next = currentIndex + delta;
    if (fields.length === 0) return;
    if (next < 0 || next >= fields.length) {
      announce(next < 0 ? 'यह पहला फ़ील्ड है।' : 'यह आख़िरी फ़ील्ड है।');
      return;
    }
    const field = fields[next]!;
    setCurrent(field.fieldId);
    announce(`फ़ील्ड ${next + 1} / ${fields.length}: ${field.label || noField}। ${metaText(field)}`);
  }

  function goToFieldId(fieldId: string) {
    const field = fields.find((candidate) => candidate.fieldId === fieldId);
    if (field) goToField(field);
  }

  function goToField(field: FormField) {
    setCurrent(field.fieldId);
    announce(`पेज में फ़ोकस: ${field.label || noField}। लौटने के लिए F6 दबाएँ।`);
    void focusField(field.fieldId);
  }

  function toggleReveal(field: FormField) {
    const revealed = new Set(active.revealed);
    const showing = !revealed.delete(field.fieldId);
    if (showing) revealed.add(field.fieldId);
    setCurrent(active.fieldId ?? field.fieldId, revealed);
    announce(showing ? `पूरा मान दिखाया गया: ${field.label || noField}` : 'मान फिर छिपा दिया गया।');
  }

  // Anything spoken here may contain personal values, so only a voice that runs
  // on this machine is used: a remote voice would send the text to a service.
  async function speakLocally(text: string): Promise<boolean> {
    if (!('tts' in chrome)) {
      announce('इस ब्राउज़र में पढ़कर सुनाना उपलब्ध नहीं है। स्क्रीन रीडर से पढ़ें।');
      return false;
    }
    const voices = await chrome.tts.getVoices();
    const local = voices.find((voice) => voice.remote === false && (voice.lang ?? '').toLowerCase().startsWith('hi'));
    if (!local) {
      announce('कोई स्थानीय हिंदी आवाज़ नहीं मिली, इसलिए पढ़कर नहीं सुनाया गया। जानकारी पाठ में यहीं है; स्क्रीन रीडर से पढ़ें।');
      return false;
    }
    chrome.tts.stop();
    void chrome.tts.speak(text, { voiceName: local.voiceName ?? '', lang: local.lang ?? 'hi-IN', rate: 1 });
    return true;
  }

  async function speak(field: FormField) {
    if (await speakLocally(spokenText(field, active.revealed.has(field.fieldId)))) announce('पढ़कर सुनाया जा रहा है।');
  }

  async function speakReview() {
    if (await speakLocally(spokenReview(summary, ackState, issues))) announce('समीक्षा सुनाई जा रही है।');
  }

  function stopSpeaking() {
    if ('tts' in chrome) chrome.tts.stop();
    announce('पढ़ना रोका गया।');
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
    <main className="mx-auto max-w-lg space-y-7 px-5 py-7 font-sans leading-relaxed text-stone-950">
      <header className="border-t-4 border-teal-900 pt-5">
        <p className="mb-2 text-sm font-bold text-teal-900">विकास संस्करण</p>
        <h1 className="text-3xl font-bold">फ़ॉर्म साथी</h1>
        <p className="mt-3">फ़ॉर्म समझें। अपनी गति से आगे बढ़ें।</p>
      </header>

      <section aria-labelledby="page-heading" className="space-y-4">
        <h2 id="page-heading" className="text-xl font-bold">पेज और कार्यप्रवाह</h2>
        <output aria-live="polite" aria-atomic="true" className="block min-h-14">{statusLine}</output>
        {snapshot === null ? null : (
          <dl className="space-y-3 border-l-4 border-teal-900 pl-4">
            <div>
              <dt className="font-bold">पेज</dt>
              <dd>{snapshot.title || 'बिना शीर्षक'} <span lang="en">({snapshot.origin})</span></dd>
            </div>
            <div>
              <dt className="font-bold">कार्यप्रवाह</dt>
              <dd>
                {page?.kind === 'portal' ? <span lang="en">{workflowText[page.workflow]}</span> : null}
                {page?.kind === 'local' ? 'स्थानीय अभ्यास पेज — यह सरकारी पोर्टल नहीं है।' : null}
                {page?.kind === 'unknown' ? 'पहचाना नहीं गया — फ़ील्ड सामान्य रूप से पढ़े गए हैं।' : null}
              </dd>
            </div>
            <div>
              <dt className="font-bold">लाइव समर्थन</dt>
              <dd>
                {page?.kind === 'portal'
                  ? supportText[livePortalSupport[page.workflow]]
                  : 'किसी समर्थित कार्यप्रवाह की पुष्टि नहीं हुई।'}
              </dd>
            </div>
          </dl>
        )}
        {tabId === null ? null : (
          <button
            type="button"
            onClick={() => void read()}
            aria-disabled={connection.state === 'reading'}
            className={primaryButton}
          >
            फ़ॉर्म फिर पढ़ें
          </button>
        )}
      </section>

      {current === null ? null : (
        <section aria-labelledby="current-heading" className="space-y-4">
          <h2 id="current-heading" className="text-xl font-bold">मौजूदा फ़ील्ड</h2>
          <div className="space-y-2 border-l-4 border-teal-900 pl-4">
            <p className="text-sm">फ़ील्ड {currentIndex + 1} / {fields.length} · {current.group || 'अन्य फ़ील्ड'}</p>
            <p className="text-lg font-bold" lang={current.lang || undefined}>{current.label || noField}</p>
            <p>{metaText(current)}</p>
            <FieldValue field={current} revealed={active.revealed.has(current.fieldId)} />
            {current.constraints.pattern === null ? null : (
              <p>पेज का प्रारूप नियम: <span lang="en">{current.constraints.pattern}</span></p>
            )}
            {current.description ? <p>{current.description}</p> : null}
            {currentResults.length === 0 ? null : (
              <ul className="space-y-2">
                {currentResults.map((result, index) => (
                  <li key={`${result.ruleId}-${index}`}>
                    <strong>{severityText[result.severity]}:</strong> {result.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => move(-1)} aria-disabled={currentIndex === 0} className={button}>
              पिछला फ़ील्ड
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-disabled={currentIndex >= fields.length - 1}
              className={button}
            >
              अगला फ़ील्ड
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => goToField(current)} className={button}>
              मूल फ़ील्ड पर जाएँ
            </button>
            {fieldValue(current, active.revealed.has(current.fieldId)).maskable ? (
              <button type="button" onClick={() => toggleReveal(current)} className={button}>
                {active.revealed.has(current.fieldId) ? 'मान छिपाएँ' : 'पूरा मान दिखाएँ'}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void speak(current)} className={button}>पढ़कर सुनाएँ</button>
            <button type="button" onClick={stopSpeaking} className={button}>पढ़ना रोकें</button>
          </div>
          <p className="text-sm">{returnRoute}</p>
        </section>
      )}

      {current === null || snapshot === null ? null : (
        <SpeechAssist
          key={current.fieldId}
          field={current}
          snapshot={snapshot}
          reference={reference}
          pack={pack}
          session={session}
          onGoToField={goToField}
          announce={announce}
        />
      )}

      {snapshot === null ? null : (
        <section aria-labelledby="reference-heading" className="space-y-3">
          <h2 id="reference-heading" className="text-xl font-bold">आपका संदर्भ</h2>
          <label htmlFor="reference-name" className="block font-bold">
            दस्तावेज़ में लिखी सटीक अंग्रेज़ी वर्तनी (वैकल्पिक)
          </label>
          <input
            id="reference-name"
            type="text"
            value={reference}
            lang="en"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setReference(event.target.value)}
            aria-describedby="reference-help"
            className="min-h-12 w-full rounded-md border-2 border-teal-950 px-3 py-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-900"
          />
          <p id="reference-help">
            यह केवल इस खुले पैनल में रहता है — न सहेजा जाता है, न कहीं भेजा जाता है। इसे अपने
            दस्तावेज़ को देखकर स्वयं लिखें; बोलकर वर्तनी तय नहीं होती।
          </p>
        </section>
      )}

      {snapshot === null ? null : (
        <Review
          snapshot={snapshot}
          results={results}
          summary={summary}
          issues={issues}
          pack={pack}
          revealed={active.revealed}
          ackState={ackState}
          ackLabel={ack === null ? null : `संशोधन ${shortRevision(ack.revision)} · ${ack.at}`}
          acknowledging={acknowledging}
          onAcknowledge={() => void acknowledge()}
          onGoToField={goToFieldId}
          onNextIssue={nextIssue}
          onSpeak={() => void speakReview()}
          onStop={stopSpeaking}
        />
      )}

      {snapshot === null || fields.length === 0 ? null : (
        <section aria-labelledby="fields-heading" className="space-y-5">
          <h2 id="fields-heading" className="text-xl font-bold">फ़ील्ड सूची</h2>
          <p>
            किसी फ़ील्ड का बटन दबाएँ: वह मौजूदा फ़ील्ड बनेगा और पेज में उसी नियंत्रण पर फ़ोकस चला जाएगा।
            केवल पढ़ने के लिए “पिछला फ़ील्ड” और “अगला फ़ील्ड” का उपयोग करें।
          </p>
          {groupFields(fields).map(([group, groupFieldList], index) => (
            <section key={group} aria-labelledby={`group-${index}`} className="space-y-3">
              <h3 id={`group-${index}`} className="text-lg font-bold">{group || 'अन्य फ़ील्ड'}</h3>
              <ul className="space-y-4">
                {groupFieldList.map((field) => (
                  <li key={field.fieldId} className="border-l-4 border-stone-400 pl-4">
                    <button
                      type="button"
                      onClick={() => goToField(field)}
                      aria-current={field.fieldId === current?.fieldId ? 'true' : undefined}
                      lang={field.lang || undefined}
                      className={`${button} w-full text-left ${
                        field.fieldId === current?.fieldId ? 'border-teal-900 bg-teal-50' : ''}`}
                    >
                      {field.label || noField}
                    </button>
                    <p className="mt-2 text-sm">{metaText(field)}</p>
                    <FieldValue field={field} revealed={active.revealed.has(field.fieldId)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      )}

      {/* Cloud setup only matters once a page has been read. */}
      {snapshot === null ? null : <ServiceAccess session={session} onSession={updateSession} />}
      {snapshot === null ? null : <CloudHelp session={session} announce={announce} />}

      <section aria-labelledby="support-heading" className="space-y-4">
        <h2 id="support-heading" className="text-xl font-bold">सहायता की स्थिति</h2>
        <p>फ़ील्ड पढ़ना, नेविगेशन, स्थानीय जाँच और बोलकर सुझाव उपलब्ध हैं। समीक्षा पूरी करना अभी उपलब्ध नहीं है।</p>
        <dl className="space-y-4 border-l-4 border-amber-700 pl-4">
          <div>
            <dt className="font-bold" lang="en">National Scholarship Portal</dt>
            <dd>{supportText[livePortalSupport.nsp]}</dd>
          </div>
          <div>
            <dt className="font-bold" lang="en">ECI Form 6</dt>
            <dd>{supportText[livePortalSupport.eciForm6]}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="service-heading" className="space-y-4 border-t border-stone-400 pt-5">
        <h2 id="service-heading" className="text-xl font-bold">सेवा से संपर्क</h2>
        <p id="service-help">यह जाँच केवल सेवा से संपर्क करती है। फ़ॉर्म की जानकारी नहीं भेजती।</p>
        <button
          type="button"
          onClick={checkService}
          aria-describedby="service-help"
          aria-disabled={service === 'checking'}
          className={primaryButton}
        >
          सेवा की स्थिति जाँचें
        </button>
        <output aria-live="polite" aria-atomic="true" className="block min-h-14">{serviceText[service]}</output>
      </section>
    </main>
  );
}
