import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  FieldInterpretResponse,
  FormField,
  FormSnapshot,
  HelpTopic,
  InterpretedKind,
} from '@form-saathi/contracts';
import { speechEligibility, validateSnapshot, type RulePack, type ValidationResult } from '@form-saathi/rules';
import {
  failureText,
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
const button = 'min-h-12 rounded-md border-2 border-teal-950 px-3 py-2 font-bold hover:bg-stone-200 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-900 aria-disabled:border-stone-500 aria-disabled:text-stone-600';
const input = 'min-h-12 w-full rounded-md border-2 border-teal-950 px-3 py-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-900';

const severityText: Record<ValidationResult['severity'], string> = {
  error: 'सुधार चाहिए',
  'needs-confirmation': 'पुष्टि चाहिए',
  unchecked: 'जाँचा नहीं गया',
};

const kindText: Record<InterpretedKind, string> = {
  name: 'नाम',
  date: 'तारीख',
  address: 'पता',
  place: 'स्थान',
  identifier: 'पहचान संख्या',
  contact: 'संपर्क',
  choice: 'विकल्प',
  document: 'दस्तावेज़',
  amount: 'राशि',
  other: 'अन्य',
};

const topicText: Record<HelpTopic, string> = {
  navigation: 'पैनल में आगे-पीछे जाना',
  review: 'समीक्षा के तीन हिस्से',
  'speech-consent': 'बोलकर बताने की सुविधा',
  privacy: 'जानकारी कहाँ रहती है',
};

const requirementText = {
  required: 'आवश्यक',
  optional: 'वैकल्पिक',
  conditional: 'शर्त पर आवश्यक',
  'read-only': 'केवल पढ़ें',
};

const blockedText = {
  inactive: 'यह फ़ील्ड अभी छिपा या निष्क्रिय है, इसलिए इसके लिए रिकॉर्डिंग नहीं होती।',
  'read-only': 'यह फ़ील्ड केवल पढ़ने के लिए है और यहाँ बदलता नहीं, इसलिए रिकॉर्डिंग नहीं होती।',
  identifier: 'यह पहचान-संख्या या संवेदनशील फ़ील्ड है। कच्ची आवाज़ से कुछ हटाया नहीं जा सकता, इसलिए इसे बोलकर नहीं भेजा जाता। मान कीबोर्ड से लिखें।',
};

export function ServiceAccess({ session, onSession }: { session: Session; onSession: (session: Session) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <section aria-labelledby="service-access-heading" className="space-y-4">
      <h2 id="service-access-heading" className="text-xl font-bold">क्लाउड सुविधा</h2>
      <div className="space-y-3 border-l-4 border-amber-700 pl-4">
        <p>
          चालू करने पर: आपकी चुनी हुई रिकॉर्डिंग ट्रांसक्रिप्शन के लिए सेवा को भेजी जाती है, और आपके
          भेजने पर उसका पाठ, चुने हुए फ़ील्ड के लेबल, निर्देश, अनुभाग और विकल्पों के साथ (उसका मान
          नहीं), समझने के लिए भेजा जाता है। पेज के लेबल या निर्देश में जो लिखा है वह वैसा ही जाता है।
          रिकॉर्डिंग में जो बोला गया वह पूरा जाता है — कच्ची आवाज़ से कुछ हटाया नहीं जा सकता। इसलिए
          पहचान-संख्या और गुप्त फ़ील्ड के लिए रिकॉर्डिंग बंद रहती है। बंद करने पर चल रही रिकॉर्डिंग
          हटा दी जाती है और चल रहे अनुरोध रद्द हो जाते हैं। कुछ भी अपने आप फ़ॉर्म में नहीं भरा जाता।
        </p>
        <button
          type="button"
          onClick={() => onSession({ ...session, consent: !session.consent })}
          aria-pressed={session.consent}
          className={button}
        >
          {session.consent ? 'क्लाउड सुविधा बंद करें' : 'समझ गया — क्लाउड सुविधा चालू करें'}
        </button>
      </div>
      <label htmlFor="pilot-credential" className="block font-bold">पायलट क्रेडेंशियल</label>
      <input
        id="pilot-credential"
        type="password"
        value={draft}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        aria-describedby="pilot-credential-help"
        className={input}
      />
      <p id="pilot-credential-help">
        {session.token === '' ? 'अभी कोई क्रेडेंशियल नहीं है।' : 'क्रेडेंशियल सहेजा हुआ है।'} यह केवल इस
        ब्राउज़र सत्र में रहता है; ब्राउज़र बंद करने पर मिट जाता है। एक्सटेंशन में कोई कुंजी नहीं होती।
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => { onSession({ ...session, token: draft.trim() }); setDraft(''); }}
          aria-disabled={draft.trim() === ''}
          className={button}
        >
          क्रेडेंशियल सहेजें
        </button>
        <button type="button" onClick={() => onSession({ ...session, token: '' })} className={button}>
          क्रेडेंशियल हटाएँ
        </button>
      </div>
    </section>
  );
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
  const ready = session.consent && session.token !== '';

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
    access.current = { consent: session.consent, token: session.token, recordable: eligibility.allowed };
    return () => {
      access.current = { consent: false, token: '', recordable: false };
      invalidate();
    };
  }, [session.consent, session.token, eligibility.allowed, snapshot.documentId, field.fieldId]);

  function currentSession(id: number, recording = false): boolean {
    return id === generation.current && access.current.consent && access.current.token !== ''
      && (!recording || access.current.recordable);
  }

  const checks = useMemo(() => (stage.kind !== 'suggestion' ? [] : validateSnapshot({
    origin: snapshot.origin,
    gaps: [],
    reference: { englishName: reference },
    // The suggestion is checked as if it were in the field; the field itself is untouched.
    fields: snapshot.fields.map((candidate) => (
      candidate.fieldId === field.fieldId ? { ...candidate, value: stage.value } : candidate
    )),
  }).filter((result) => result.fieldId === field.fieldId)), [field.fieldId, reference, snapshot, stage]);

  function fail(failure: Failure, text: string | null) {
    setStage({ kind: 'failed', failure, text });
    announce(failureText[failure]);
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
    announce('रिकॉर्डिंग शुरू। रोकने के लिए “रोकें और भेजें” दबाएँ, बिना भेजे हटाने के लिए “रद्द करें”।');
    for (let tick = 1; tick <= RECORDING_LIMIT_MS / 1000; tick += 1) {
      timers.current.push(setTimeout(() => { if (ownsRecorder()) setSeconds(tick); }, tick * 1000));
    }
    timers.current.push(setTimeout(() => {
      if (ownsRecorder() && active.state === 'recording') {
        announce('15 सेकंड पूरे। रिकॉर्डिंग भेजी जा रही है।');
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
      ? 'अनुरोध रद्द किया गया। जो भेजा जा चुका था वह वापस नहीं आता; उसका जवाब अब नहीं लिया जाएगा।'
      : 'रिकॉर्डिंग हटा दी गई। कुछ नहीं भेजा गया।');
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
    announce('रिकॉर्डिंग भेजी गई; पाठ बन रहा है…');
    const outcome = await transcribe(audio, access.current.token, controller.signal);
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
    announce('पाठ मिला। उसे सुधारें, फिर “इस पाठ को समझें” दबाएँ।');
  }

  async function interpret(text: string) {
    const trimmed = text.trim();
    const id = generation.current;
    if (trimmed === '' || !currentSession(id, true)) return;
    const controller = begin(id);
    if (controller === null) return;
    setStage({ kind: 'interpreting', text: trimmed });
    const outcome = await interpretValue(trimmed, field, access.current.token, controller.signal);
    if (!stillCurrent(id, controller)) return;
    if (!outcome.ok) {
      if (outcome.failure !== 'cancelled') fail(outcome.failure, trimmed);
      return;
    }
    const { interpretation } = outcome.data;
    if (interpretation.outcome === 'unknown') {
      setStage({ kind: 'clarify', text: trimmed, explanation: interpretation.explanation });
      announce('स्पष्टीकरण चाहिए; कोई मान नहीं सुझाया गया।');
      return;
    }
    setStage({ kind: 'suggestion', text: trimmed, value: interpretation.value, explanation: interpretation.explanation });
    announce(`सुझाव तैयार: ${interpretation.value}। स्थानीय जाँच नीचे है।`);
  }

  async function askMeaning() {
    if (request.current !== null) return;
    const id = generation.current;
    const controller = begin(id);
    if (controller === null) return;
    setMeaning({ kind: 'asking' });
    const outcome = await interpretField(field, access.current.token, controller.signal);
    if (!stillCurrent(id, controller)) return;
    if (!outcome.ok) {
      setMeaning({ kind: 'failed', failure: outcome.failure });
      announce(failureText[outcome.failure]);
      return;
    }
    setMeaning({ kind: 'pending', result: outcome.data.interpretation });
    announce(outcome.data.interpretation.outcome === 'unknown'
      ? 'सेवा को इस फ़ील्ड का अर्थ स्पष्ट नहीं लगा।'
      : 'अर्थ का अनुमान मिला; उसे पढ़कर पुष्टि करें।');
  }

  async function copySuggestion(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      announce('सुझाव क्लिपबोर्ड में है। पेज के फ़ील्ड में इसे आप स्वयं चिपकाएँ।');
    } catch {
      announce('क्लिपबोर्ड उपलब्ध नहीं है। सुझाव को पढ़कर स्वयं लिखें।');
    }
  }

  const heading = 'बोलकर बताएँ';
  return (
    <section aria-labelledby="speech-heading" className="space-y-4">
      <h2 id="speech-heading" className="text-xl font-bold">{heading}</h2>
      <p className="text-sm">
        पैक में दर्ज: {rule ? `${requirementText[rule.requirement]} · स्रोत ${rule.source}` : 'यह फ़ील्ड नियम पैक में नहीं है।'}
      </p>

      {!eligibility.allowed ? <p>{blockedText[eligibility.reason]}</p> : !ready ? (
        <p>
          {session.consent
            ? 'बोलकर बताने के लिए पहले पायलट क्रेडेंशियल सहेजें। कीबोर्ड से पढ़ना और जाँच वैसे ही चलते रहते हैं।'
            : 'बोलकर बताने के लिए पहले नीचे “क्लाउड सुविधा” चालू करें। कीबोर्ड से पढ़ना और जाँच वैसे ही चलते रहते हैं।'}
        </p>
      ) : (
        <div className="space-y-3 border-l-4 border-teal-900 pl-4">
          {stage.kind === 'idle' ? (
            <>
              <p>
                रिकॉर्डिंग अधिकतम 15 सेकंड की होती है। “रोकें और भेजें” दबाने पर वह सेवा को जाती है;
                उससे पहले “रद्द करें” दबाने पर कुछ नहीं भेजा जाता। भेजने के बाद रद्द करने पर सर्वर
                भाषा-सेवा को भेजा जा रहा अपना अनुरोध भी रोक देता है और जवाब छोड़ दिया जाता है; पर जो
                भाषा-सेवा तक पहुँच चुका वह वापस नहीं आता।
              </p>
              <button type="button" onClick={() => void startRecording()} className={button}>रिकॉर्डिंग शुरू करें</button>
            </>
          ) : null}
          {stage.kind === 'recording' ? (
            <>
              <p className="font-bold">
                <span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-full bg-red-700" />
                रिकॉर्डिंग चल रही है — {seconds} सेकंड (अधिकतम 15)
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={stopRecording} className={button}>रोकें और भेजें</button>
                <button type="button" onClick={cancel} className={button}>रद्द करें</button>
              </div>
            </>
          ) : null}
          {stage.kind === 'transcribing' || stage.kind === 'interpreting' ? (
            <>
              <p>{stage.kind === 'transcribing' ? 'पाठ बन रहा है…' : 'सुझाव बन रहा है…'}</p>
              <button type="button" onClick={cancel} className={button}>रद्द करें</button>
            </>
          ) : null}
          {stage.kind === 'transcript' ? (
            <>
              <label htmlFor="transcript" className="block font-bold">सुना गया पाठ — ज़रूरत हो तो सुधारें</label>
              <textarea
                id="transcript"
                value={stage.text}
                rows={3}
                onChange={(event) => setStage({ kind: 'transcript', text: event.target.value })}
                aria-describedby="transcript-help"
                className={input}
              />
              <p id="transcript-help" className="text-sm">यह पाठ सेवा से आया है और गलत हो सकता है। समझने के लिए भेजने से पहले उसे ठीक कर लें।</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void interpret(stage.text)} className={button}>इस पाठ को समझें</button>
                <button type="button" onClick={() => setStage({ kind: 'idle' })} className={button}>फिर से रिकॉर्ड करें</button>
              </div>
            </>
          ) : null}
          {stage.kind === 'suggestion' ? (
            <>
              <p>सुझाया गया मान: <strong lang={field.lang || undefined}>{stage.value}</strong></p>
              <p>{stage.explanation}</p>
              {checks.length === 0 ? (
                <p>स्थानीय जाँच में कोई कमी नहीं मिली। यह पुष्टि नहीं है: पोर्टल के नियम अलग हो सकते हैं।</p>
              ) : (
                <ul className="space-y-2">
                  {checks.map((result, index) => (
                    <li key={`${result.ruleId}-${index}`}><strong>{severityText[result.severity]}:</strong> {result.message}</li>
                  ))}
                </ul>
              )}
              <p>यह सुझाव है, निर्णय नहीं। इसे फ़ॉर्म में आप स्वयं भरेंगे; पैनल कुछ नहीं भरता।</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => onGoToField(field)} className={button}>मूल फ़ील्ड पर जाएँ</button>
                <button type="button" onClick={() => void copySuggestion(stage.value)} className={button}>सुझाव कॉपी करें</button>
                <button type="button" onClick={() => setStage({ kind: 'idle' })} className={button}>फिर से रिकॉर्ड करें</button>
              </div>
            </>
          ) : null}
          {stage.kind === 'clarify' ? (
            <>
              <p>स्पष्ट करें: {stage.explanation}</p>
              <p>कोई मान नहीं सुझाया गया, क्योंकि जो कहा गया वह पूरा या स्पष्ट नहीं था।</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setStage({ kind: 'transcript', text: stage.text })} className={button}>पाठ सुधारें</button>
                <button type="button" onClick={() => setStage({ kind: 'idle' })} className={button}>फिर से रिकॉर्ड करें</button>
              </div>
            </>
          ) : null}
          {stage.kind === 'failed' ? (
            <>
              <p>{failureText[stage.failure]}</p>
              <div className="flex flex-wrap gap-3">
                {stage.text === null ? null : (
                  <button type="button" onClick={() => setStage({ kind: 'transcript', text: stage.text ?? '' })} className={button}>
                    पाठ पर लौटें
                  </button>
                )}
                <button type="button" onClick={() => setStage({ kind: 'idle' })} className={button}>फिर से कोशिश करें</button>
              </div>
            </>
          ) : null}
        </div>
      )}

      <h3 className="text-lg font-bold">इस फ़ील्ड का अर्थ</h3>
      {!ready ? (
        <p className="text-sm">अर्थ पूछने के लिए क्लाउड सुविधा और क्रेडेंशियल चाहिए। भेजा जाता है: केवल लेबल, निर्देश, अनुभाग और विकल्प — मान नहीं।</p>
      ) : (
        <div className="space-y-3">
          {meaning.kind === 'none' || meaning.kind === 'failed' ? (
            <>
              {meaning.kind === 'failed' ? <p>{failureText[meaning.failure]}</p> : null}
              <p className="text-sm">भेजा जाएगा: केवल इस फ़ील्ड का लेबल, निर्देश, अनुभाग और विकल्प — मान नहीं।</p>
              <button type="button" onClick={() => void askMeaning()} className={button}>इस फ़ील्ड का अर्थ पूछें</button>
            </>
          ) : null}
          {meaning.kind === 'asking' ? <p>अर्थ पूछा जा रहा है…</p> : null}
          {meaning.kind === 'pending' || meaning.kind === 'accepted' ? (
            <div className="space-y-2 border-l-4 border-amber-700 pl-4">
              {meaning.result.outcome === 'unknown' ? (
                <p>सेवा को अर्थ स्पष्ट नहीं लगा: {meaning.result.explanation}</p>
              ) : (
                <>
                  <p>AI का अनुमान: {kindText[meaning.result.kind]}</p>
                  <p>{meaning.result.explanation}</p>
                  {meaning.result.example ? <p>उदाहरण: {meaning.result.example}</p> : null}
                </>
              )}
              <p className="text-sm">
                {meaning.kind === 'accepted'
                  ? 'आपने इसे मान लिया है। यह फिर भी अनुमान है; पोर्टल के निर्देश ही मान्य हैं।'
                  : 'यह अनुमान है, पोर्टल का नियम नहीं। ऊपर पैक की जानकारी और पेज के निर्देश से मिलाकर ही मानें।'}
              </p>
              <div className="flex flex-wrap gap-3">
                {meaning.kind === 'pending' && meaning.result.outcome === 'suggestion' ? (
                  <button type="button" onClick={() => setMeaning({ kind: 'accepted', result: meaning.result })} className={button}>
                    मिलाकर देखा — मान लें
                  </button>
                ) : null}
                <button type="button" onClick={() => setMeaning({ kind: 'none' })} className={button}>हटाएँ</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function CloudHelp({ session, announce }: { session: Session; announce: (text: string) => void }) {
  const [topic, setTopic] = useState<HelpTopic>('navigation');
  const [help, setHelp] = useState<{ kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; url: string; text: string } | { kind: 'failed'; failure: Failure }>({ kind: 'idle' });
  const request = useRef<AbortController | null>(null);
  const url = help.kind === 'ready' ? help.url : null;
  const ready = session.consent && session.token !== '';

  useEffect(() => () => { if (url !== null) URL.revokeObjectURL(url); }, [url]);
  // Withdrawing consent, removing the credential or leaving the panel drops a
  // pending request; its reply, if it still arrives, is not shown.
  useLayoutEffect(() => () => {
    request.current?.abort();
    request.current = null;
    setHelp((current) => (current.kind === 'loading' ? { kind: 'idle' } : current));
  }, [session.consent, session.token]);

  async function fetchHelp() {
    // The button stays focusable and explains itself; the guard is here, not in aria.
    if (!ready) {
      announce('इसके लिए पहले क्लाउड सुविधा चालू करें और क्रेडेंशियल सहेजें।');
      return;
    }
    if (request.current !== null) return;
    const controller = new AbortController();
    request.current = controller;
    setHelp({ kind: 'loading' });
    const outcome = await speechHelp(topic, session.token, controller.signal);
    if (request.current !== controller) return;
    request.current = null;
    if (!outcome.ok) {
      setHelp({ kind: 'failed', failure: outcome.failure });
      announce(failureText[outcome.failure]);
      return;
    }
    const bytes = Uint8Array.from(atob(outcome.data.audio), (character) => character.charCodeAt(0));
    setHelp({ kind: 'ready', url: URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), text: outcome.data.text });
    announce('सहायता का ऑडियो तैयार है। चलाने के लिए प्लेयर का उपयोग करें।');
  }

  return (
    <section aria-labelledby="help-heading" className="space-y-4">
      <h2 id="help-heading" className="text-xl font-bold">सहायता सुनें</h2>
      <p>
        यह सामान्य सहायता है जो सेवा अपने पास रखती है; आपके फ़ॉर्म की कोई जानकारी नहीं भेजी जाती।
        फ़ील्ड के मान इस तरह कभी नहीं सुनाए जाते।
      </p>
      <label htmlFor="help-topic" className="block font-bold">विषय</label>
      <select id="help-topic" value={topic} onChange={(event) => setTopic(event.target.value as HelpTopic)} className={input}>
        {(Object.keys(topicText) as HelpTopic[]).map((candidate) => (
          <option key={candidate} value={candidate}>{topicText[candidate]}</option>
        ))}
      </select>
      <button type="button" onClick={() => void fetchHelp()} aria-disabled={!ready || help.kind === 'loading'} className={button}>
        सहायता का ऑडियो लाएँ
      </button>
      {!ready ? <p className="text-sm">इसके लिए क्लाउड सुविधा और क्रेडेंशियल चाहिए।</p> : null}
      {help.kind === 'loading' ? <p>ऑडियो लाया जा रहा है…</p> : null}
      {help.kind === 'failed' ? <p>{failureText[help.failure]}</p> : null}
      {help.kind === 'ready' ? (
        <>
          <p>{help.text}</p>
          {/* Native controls: play, pause and seek all work from the keyboard. */}
          <audio controls src={help.url} aria-label={`सहायता: ${topicText[topic]}`} className="w-full">
            <track kind="captions" />
          </audio>
        </>
      ) : null}
    </section>
  );
}
