import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  FieldInterpretResponse,
  FormField,
  FormSnapshot,
  HelpTopic,
} from '@form-saathi/contracts';
import { displayExplanation, speechCapabilities } from '@form-saathi/contracts';
import { useLocale } from '../../../../packages/ui/Locale';
import { speechEligibility, validateSnapshot, type RulePack } from '@form-saathi/rules';
import {
  interpretField,
  interpretValue,
  speechHelp,
  transcribe,
  type Failure,
  type Session,
} from './api';

// Spoken values and field meanings through the optional service. Every step is
// the person's own action, every reply is a suggestion checked by the local
// rules, and nothing here ever writes into the page.

const RECORDING_LIMIT_MS = 15_000;
const button = 'button';
const input = '';
export function ServiceAccess({ session, onSession }: { session: Session; onSession: (session: Session) => void }) {
  const { t } = useLocale();
  const [draft, setDraft] = useState('');
  return <section aria-labelledby="service-access-heading" className="stack">
    <h2 id="service-access-heading">{t('cloud.heading')}</h2><p className="small">{t('cloud.consent')}</p>
    <button type="button" className={button} aria-pressed={session.consent} onClick={() => onSession({ ...session, consent: !session.consent })}>{t(session.consent ? 'cloud.disable' : 'cloud.enable')}</button>
    <label htmlFor="pilot-credential">{t('cloud.credential')}</label>
    <input id="pilot-credential" type="password" dir="ltr" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} aria-describedby="pilot-credential-help" />
    <p id="pilot-credential-help" className="small"><span>{t(session.token ? 'cloud.saved' : 'cloud.noCredential')}</span> {t('cloud.session')}</p>
    <div className="actions"><button type="button" className={button} aria-disabled={!draft.trim()} onClick={() => { if (draft.trim()) { onSession({ ...session, token: draft.trim() }); setDraft(''); } }}>{t('cloud.save')}</button>
    <button type="button" className={button} onClick={() => onSession({ ...session, token: '' })}>{t('cloud.remove')}</button></div>
  </section>;
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'recording' }
  | { kind: 'transcribing' }
  | { kind: 'transcript'; text: string }
  | { kind: 'interpreting'; text: string }
  | { kind: 'suggestion'; text: string; value: string; explanation: string }
  | { kind: 'clarify'; text: string; explanation: string }
  | { kind: 'failed'; failure: Failure; text: string | null };

type Meaning =
  | { kind: 'none' }
  | { kind: 'asking' }
  | { kind: 'pending'; result: FieldInterpretResponse['interpretation'] }
  | { kind: 'accepted'; result: FieldInterpretResponse['interpretation'] }
  | { kind: 'failed'; failure: Failure };

export function SpeechAssist({ field, snapshot, reference, pack, session, onGoToField, announce }: {
  field: FormField;
  snapshot: FormSnapshot;
  reference: string;
  pack: RulePack | null;
  session: Session;
  onGoToField: (field: FormField) => void;
  announce: (text: string) => void;
}) {
  const { locale, t } = useLocale();
  const capability = speechCapabilities[locale];
  const speechSection = useRef<HTMLElement>(null);
  const hadFocus = useRef(false);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [seconds, setSeconds] = useState(0);
  const [meaning, setMeaning] = useState<Meaning>({ kind: 'none' });
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef<AbortController | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // One session per attempt: a permission, recorder callback, timer or reply
  // that belongs to an earlier number may change nothing and send nothing.
  const generation = useRef(0);
  const awaitingPermission = useRef<number | null>(null);
  const access = useRef({ consent: false, token: '', recordable: false });

  const eligibility = speechEligibility(field, pack);
  const rule = pack?.fields.find((candidate) => candidate.key === field.key) ?? null;
  const ready = session.consent && session.token !== '' && capability.interpretation !== null;

  function clearTimers() {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }

  function releaseMicrophone(media: MediaStream | null = stream.current) {
    for (const track of media?.getTracks() ?? []) track.stop();
    if (media === stream.current) stream.current = null;
  }

  /** Ends the current session: nothing started before this point may still send. */
  function invalidate() {
    generation.current += 1;
    awaitingPermission.current = null;
    clearTimers();
    request.current?.abort();
    request.current = null;
    const active = recorder.current;
    recorder.current = null;
    if (active && active.state !== 'inactive') active.stop();
    releaseMicrophone();
    setStage({ kind: 'idle' });
    setMeaning((current) => (current.kind === 'asking' ? { kind: 'none' } : current));
  }

  // Leaving the field or the panel, withdrawing consent, removing the
  // credential or the field becoming ineligible all stop everything at once.
  useLayoutEffect(() => {
    access.current = { consent: session.consent, token: session.token, recordable: eligibility.allowed && capability.transcription !== null };
    return () => {
      access.current = { consent: false, token: '', recordable: false };
      invalidate();
    };
  }, [session.consent, session.token, eligibility.allowed, snapshot.documentId, field.fieldId, locale, capability.transcription]);

  function currentSession(id: number, recording = false): boolean {
    return id === generation.current && access.current.consent && access.current.token !== ''
      && (!recording || access.current.recordable);
  }

  const checks = useMemo(() => (stage.kind !== 'suggestion' ? [] : validateSnapshot({
    locale,
    origin: snapshot.origin,
    gaps: [],
    reference: { englishName: reference },
    // The suggestion is checked as if it were in the field; the field itself is untouched.
    fields: snapshot.fields.map((candidate) => (
      candidate.fieldId === field.fieldId ? { ...candidate, value: stage.value } : candidate
    )),
  }).filter((result) => result.fieldId === field.fieldId)), [field.fieldId, locale, reference, snapshot, stage]);

  function fail(failure: Failure, text: string | null) {
    setStage({ kind: 'failed', failure, text });
    announce(t(`error.${failure}`));
  }

  async function startRecording() {
    // A second press while permission is pending or a recording runs does nothing.
    if (awaitingPermission.current !== null || recorder.current !== null) return;
    if (!currentSession(generation.current, true) || !('mediaDevices' in navigator)) {
      fail('microphone_unavailable', null);
      return;
    }
    invalidate();
    const id = generation.current;
    awaitingPermission.current = id;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      if (awaitingPermission.current === id) awaitingPermission.current = null;
      if (!currentSession(id, true)) return;
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      fail(denied ? 'microphone_denied' : 'microphone_unavailable', null);
      return;
    }
    if (awaitingPermission.current === id) awaitingPermission.current = null;
    // Permission arrived late: the field, panel, consent or credential may have
    // changed meanwhile. The session number covers all of them, because each
    // change invalidates. Then the microphone is released, and nothing recorded.
    if (!currentSession(id, true)) {
      releaseMicrophone(media);
      return;
    }
    stream.current = media;
    // Only this recorder owns this buffer, including after a delayed stop event.
    const chunks: Blob[] = [];
    let active: MediaRecorder;
    const ownsRecorder = () => currentSession(id, true) && recorder.current === active;
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      active = new MediaRecorder(media, { mimeType });
      active.ondataavailable = (event) => { if (ownsRecorder() && event.data.size > 0) chunks.push(event.data); };
      active.onstop = () => {
        if (!ownsRecorder()) return;
        recorder.current = null;
        releaseMicrophone(media);
        clearTimers();
        const audio = new Blob(chunks, { type: 'audio/webm' });
        chunks.length = 0;
        if (audio.size === 0) {
          fail('nothing_recorded', null);
          return;
        }
        void sendRecording(audio, id);
      };
      recorder.current = active;
      active.start();
    } catch {
      invalidate();
      fail('microphone_unavailable', null);
      return;
    }
    setSeconds(0);
    setStage({ kind: 'recording' });
    announce(t('speech.started'));
    for (let tick = 1; tick <= RECORDING_LIMIT_MS / 1000; tick += 1) {
      timers.current.push(setTimeout(() => { if (ownsRecorder()) setSeconds(tick); }, tick * 1000));
    }
    timers.current.push(setTimeout(() => {
      if (ownsRecorder() && active.state === 'recording') {
        announce(t('speech.limit'));
        active.stop();
      }
    }, RECORDING_LIMIT_MS));
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  function cancel() {
    // Before upload nothing has left the browser. Once a request has started,
    // what was sent is with the service; only its reply is refused here.
    const sent = stage.kind === 'transcribing' || stage.kind === 'interpreting';
    invalidate();
    announce(sent
      ? t('speech.cancelledSent')
      : t('speech.cancelledLocal'));
  }

  function begin(id: number): AbortController | null {
    if (!currentSession(id)) return null;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    return controller;
  }

  /** A reply counts only for the session and request it was made in. */
  function stillCurrent(id: number, controller: AbortController): boolean {
    if (!currentSession(id) || controller.signal.aborted || request.current !== controller) return false;
    request.current = null;
    return true;
  }

  async function sendRecording(audio: Blob, id: number) {
    if (!currentSession(id, true)) return;
    const controller = begin(id);
    if (controller === null) return;
    setStage({ kind: 'transcribing' });
    announce(t('speech.transcribing'));
    const outcome = await transcribe(audio, access.current.token, controller.signal, locale);
    if (!stillCurrent(id, controller)) return;
    if (!outcome.ok) {
      if (outcome.failure !== 'cancelled') fail(outcome.failure, null);
      return;
    }
    const text = outcome.data.transcript.trim();
    if (text === '') {
      fail('nothing_recorded', null);
      return;
    }
    setStage({ kind: 'transcript', text });
    announce(t('speech.transcriptReady'));
  }

  async function interpret(text: string) {
    const trimmed = text.trim();
    const id = generation.current;
    if (trimmed === '' || !currentSession(id, true)) return;
    const controller = begin(id);
    if (controller === null) return;
    setStage({ kind: 'interpreting', text: trimmed });
    const outcome = await interpretValue(trimmed, field, access.current.token, controller.signal, locale);
    if (!stillCurrent(id, controller)) return;
    if (!outcome.ok) {
      if (outcome.failure !== 'cancelled') fail(outcome.failure, trimmed);
      return;
    }
    const { interpretation } = outcome.data;
    if (interpretation.outcome === 'unknown') {
      setStage({ kind: 'clarify', text: trimmed, explanation: interpretation.explanation });
      announce(t('speech.clarify'));
      return;
    }
    setStage({ kind: 'suggestion', text: trimmed, value: interpretation.value, explanation: interpretation.explanation });
    announce(t('speech.suggestionReady', { value: interpretation.value }));
  }

  async function askMeaning() {
    if (request.current !== null) return;
    const id = generation.current;
    const controller = begin(id);
    if (controller === null) return;
    setMeaning({ kind: 'asking' });
    const outcome = await interpretField(field, access.current.token, controller.signal, locale);
    if (!stillCurrent(id, controller)) return;
    if (!outcome.ok) {
      setMeaning({ kind: 'failed', failure: outcome.failure });
      announce(t(`error.${outcome.failure}`));
      return;
    }
    setMeaning({ kind: 'pending', result: outcome.data.interpretation });
    announce(outcome.data.interpretation.outcome === 'unknown'
      ? t('meaning.unknown')
      : t('meaning.ready'));
  }

  async function copySuggestion(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      announce(t('speech.copied'));
    } catch {
      announce(t('speech.copyFailed'));
    }
  }

  useLayoutEffect(() => {
    // A removed stage button must not leave keyboard focus at the document root.
    if (hadFocus.current && document.hasFocus() && document.activeElement === document.body) {
      speechSection.current?.querySelector<HTMLElement>('textarea, button')?.focus();
    }
  }, [stage.kind]);

  return <section ref={speechSection} onFocusCapture={() => { hadFocus.current = true; }} onBlurCapture={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) hadFocus.current = false; }} aria-labelledby="speech-heading" className="stack speech-assist">
    <h2 id="speech-heading">{t('speech.heading')}</h2>
    {capability.transcription === null ? <p className="small muted">{t('speech.unavailable')}</p> : <>
      {!ready ? <p className="small muted">{t('cloud.setup')}</p> : null}
      {!eligibility.allowed ? <p className="small">{t(`speech.blocked.${eligibility.reason}`)}</p> : !ready ? null : <div className="stack">
        {stage.kind === 'idle' ? <><p className="small">{t('speech.recordingHelp')}</p><div className="actions"><button type="button" className={button} onClick={() => void startRecording()}>{t('speech.start')}</button><button type="button" className={button} onClick={() => setStage({ kind: 'transcript', text: '' })}>{t('speech.type')}</button></div></> : null}
        {stage.kind === 'recording' ? <div className="recording stack"><p><strong>{t('speech.recording', { seconds })}</strong></p><div className="actions"><button type="button" onClick={stopRecording} className={button}>{t('speech.send')}</button><button type="button" onClick={cancel} className={button}>{t('cancel')}</button></div></div> : null}
        {stage.kind === 'transcribing' || stage.kind === 'interpreting' ? <><p>{t(stage.kind === 'transcribing' ? 'speech.transcribing' : 'speech.interpreting')}</p><button type="button" onClick={cancel} className={button}>{t('cancel')}</button></> : null}
        {stage.kind === 'transcript' ? <><label htmlFor="transcript">{t('speech.transcript')}</label><textarea id="transcript" value={stage.text} rows={3} dir="auto" onChange={(event) => setStage({ kind: 'transcript', text: event.target.value })} aria-describedby="transcript-help" className={input} /><p id="transcript-help" className="small">{t('speech.transcriptHelp')}</p><div className="actions"><button type="button" className={button} onClick={() => void interpret(stage.text)}>{t('speech.interpret')}</button><button type="button" className={button} onClick={() => setStage({ kind: 'idle' })}>{t('speech.again')}</button></div></> : null}
        {stage.kind === 'suggestion' ? <>
          <p>{t('speech.suggested')} <strong><bdi lang={field.lang || undefined}>{stage.value}</bdi></strong></p>
          <p className="eyebrow">{t('meaning.generated')}</p><p>{displayExplanation(stage.explanation)}</p>
          {!checks.length ? <p>{t('review.noIssue')}</p> : <ul className="issue-list">{checks.map((result, index) => <li className={`issue ${result.severity}`} key={`${result.ruleId}-${index}`}><strong>{t(`severity.${result.severity}`)}:</strong> {result.message}</li>)}</ul>}
          <p className="small">{t('speech.suggestionHelp')}</p><div className="actions"><button type="button" className={button} onClick={() => onGoToField(field)}>{t('field.go')}</button><button type="button" className={button} onClick={() => void copySuggestion(stage.value)}>{t('speech.copy')}</button><button type="button" className={button} onClick={() => setStage({ kind: 'idle' })}>{t('speech.again')}</button></div>
        </> : null}
        {stage.kind === 'clarify' ? <><p>{displayExplanation(stage.explanation)}</p><p>{t('speech.clarify')}</p><div className="actions"><button type="button" className={button} onClick={() => setStage({ kind: 'transcript', text: stage.text })}>{t('speech.edit')}</button><button type="button" className={button} onClick={() => setStage({ kind: 'idle' })}>{t('speech.again')}</button></div></> : null}
        {stage.kind === 'failed' ? <><p>{t(`error.${stage.failure}`)}</p><div className="actions">{stage.text === null ? null : <button type="button" className={button} onClick={() => setStage({ kind: 'transcript', text: stage.text ?? '' })}>{t('speech.back')}</button>}<button type="button" className={button} onClick={() => setStage({ kind: 'idle' })}>{t('speech.retry')}</button></div></> : null}
      </div>}
      {ready ? <div className="stack">
        {rule ? <p className="small">{t(rule.requirement)} · {t('source')} <bdi>{rule.source}</bdi></p> : <p className="small">{t('review.unmapped')}</p>}
        <p className="small">{t('meaning.help')}</p>
          {meaning.kind === 'none' || meaning.kind === 'failed' ? <>{meaning.kind === 'failed' ? <p>{t(`error.${meaning.failure}`)}</p> : null}<button type="button" className={button} onClick={() => void askMeaning()}>{t('meaning.ask')}</button></> : null}
          {meaning.kind === 'asking' ? <><p>{t('meaning.asking')}</p><button type="button" className={button} onClick={cancel}>{t('cancel')}</button></> : null}
          {meaning.kind === 'pending' || meaning.kind === 'accepted' ? <div className="stack">
            <p className="eyebrow">{t('meaning.generated')}</p>
            {meaning.result.outcome === 'unknown' ? <p>{t('meaning.unknown')}</p> : <p>{t(`kind.${meaning.result.kind}`)}</p>}
            <p>{displayExplanation(meaning.result.explanation)}</p>
            {meaning.result.outcome === 'suggestion' && meaning.result.example ? <p>{t('meaning.example')} <bdi>{meaning.result.example}</bdi></p> : null}
            <p className="small">{t(meaning.kind === 'accepted' ? 'meaning.accepted' : 'meaning.confirm')}</p>
            <div className="actions">{meaning.kind === 'pending' && meaning.result.outcome === 'suggestion' ? <button type="button" className={button} onClick={() => setMeaning({ kind: 'accepted', result: meaning.result })}>{t('meaning.accept')}</button> : null}<button type="button" className={button} onClick={() => setMeaning({ kind: 'none' })}>{t('meaning.dismiss')}</button></div>
          </div> : null}
      </div> : null}
    </>}
  </section>;
}

export function CloudHelp({ session, announce }: { session: Session; announce: (text: string) => void }) {
  const { locale, t } = useLocale();
  const [topic, setTopic] = useState<HelpTopic>('navigation');
  const [help, setHelp] = useState<{ kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; url: string; text: string; topic: HelpTopic } | { kind: 'failed'; failure: Failure }>({ kind: 'idle' });
  const request = useRef<AbortController | null>(null);
  const url = help.kind === 'ready' ? help.url : null;
  const ready = session.consent && session.token !== '' && speechCapabilities[locale].speechOutput !== null;
  useEffect(() => () => { if (url !== null) URL.revokeObjectURL(url); }, [url]);
  useLayoutEffect(() => () => {
    request.current?.abort(); request.current = null;
    setHelp({ kind: 'idle' });
  }, [session.consent, session.token, locale]);
  async function fetchHelp() {
    if (!ready) { announce(t('cloud.setup')); return; }
    if (request.current !== null) return;
    const controller = new AbortController(); request.current = controller; setHelp({ kind: 'loading' });
    const outcome = await speechHelp(topic, session.token, controller.signal, locale);
    if (request.current !== controller) return;
    request.current = null;
    if (!outcome.ok) { setHelp({ kind: 'failed', failure: outcome.failure }); announce(t(`error.${outcome.failure}`)); return; }
    const bytes = Uint8Array.from(atob(outcome.data.audio), (character) => character.charCodeAt(0));
    setHelp({ kind: 'ready', url: URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), text: outcome.data.text, topic });
    announce(t('help.ready'));
  }
  return <section aria-labelledby="help-heading" className="stack"><h2 id="help-heading">{t('help.heading')}</h2><p className="small">{t('help.description')}</p>
    {speechCapabilities[locale].speechOutput === null ? <p>{t('speech.unavailable')}</p> : <>
      <label htmlFor="help-topic">{t('help.topic')}</label><select id="help-topic" value={topic} onChange={(event) => setTopic(event.target.value as HelpTopic)}>{(['navigation', 'review', 'speech-consent', 'privacy'] as const).map((item) => <option key={item} value={item}>{t(`help.${item}`)}</option>)}</select>
      <button type="button" className={button} aria-disabled={!ready || help.kind === 'loading'} onClick={() => void fetchHelp()}>{t('help.fetch')}</button>
      {!ready ? <p className="small">{t('cloud.setup')}</p> : null}
      {help.kind === 'loading' ? <p>{t('help.loading')}</p> : null}
      {help.kind === 'failed' ? <p>{t(`error.${help.failure}`)}</p> : null}
      {help.kind === 'ready' ? <><p>{displayExplanation(help.text)}</p><audio controls src={help.url} aria-label={t('help.audio', { topic: t(`help.${help.topic}`) })} style={{ width: '100%' }}><track kind="captions" /></audio></> : null}
    </>}
  </section>;
}
