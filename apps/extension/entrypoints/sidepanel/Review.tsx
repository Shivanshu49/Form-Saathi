import type { FormField, FormSnapshot } from '@form-saathi/contracts';
import type { ReviewSummary, RulePack, Severity, ValidationResult } from '@form-saathi/rules';
import { fieldValue, noField } from './fields';

// The final review. It describes what was read and what the local rules found,
// and records that the person has read exactly that. It never says a form is
// accepted, an identity verified or an application submitted.

const button = 'min-h-12 rounded-md border-2 border-teal-950 px-3 py-2 font-bold hover:bg-stone-200 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-900 aria-disabled:border-stone-500 aria-disabled:text-stone-600';

export const severityText: Record<Severity, string> = {
  error: 'सुधार चाहिए',
  'needs-confirmation': 'पुष्टि चाहिए',
  unchecked: 'जाँचा नहीं गया',
};
const severityOrder: Severity[] = ['error', 'needs-confirmation', 'unchecked'];

export type AckState = 'none' | 'current' | 'stale';

export function reviewStatusText(ackState: AckState, summary: ReviewSummary): string {
  if (ackState === 'none') return 'समीक्षा अभी स्वीकृत नहीं: नीचे की जानकारी पढ़कर स्वीकृति दें।';
  if (ackState === 'stale') {
    return 'स्वीकृति अमान्य: स्वीकृति के बाद फ़ॉर्म, नियम या संदर्भ बदला। समीक्षा फिर पढ़ें और फिर स्वीकृति दें।';
  }
  switch (summary.outcome) {
    case 'blocked':
      return 'रुकी हुई: कुछ हिस्से ऐसे हैं जिन तक पैनल नहीं पहुँचता या जो यहाँ नहीं बदलते। उन्हें आप पोर्टल पर स्वयं संभालें।';
    case 'corrections-pending':
      return `समीक्षा पढ़ी गई, पर ${summary.errors} सुधार बाकी हैं।`;
    case 'confirmation-needed':
      return `समीक्षा पढ़ी गई, पर ${summary.confirmations} बातों की पुष्टि आपको स्वयं करनी है।`;
    case 'partial-coverage':
      return 'आंशिक समीक्षा: कवरेज अधूरी है, इसलिए यह पूरी समीक्षा नहीं है।';
    case 'clear':
      return `समीक्षा स्वीकृत: जो जाँचा जा सकता था उसमें कोई कमी नहीं मिली। ${summary.permanentLimits} बातें कभी नहीं जाँची जातीं।`;
  }
}

/** What the spoken review says; values inside messages need a local voice. */
export function spokenReview(summary: ReviewSummary, ackState: AckState, issues: ValidationResult[]): string {
  return [
    `समीक्षा। ${reviewStatusText(ackState, summary)}`,
    `${summary.errors} सुधार, ${summary.confirmations} पुष्टि, ${summary.unchecked} जाँचा नहीं गया।`,
    ...issues.map((issue, index) => `समस्या ${index + 1}: ${issue.message}`),
    'यह समीक्षा पोर्टल की स्वीकृति, पहचान की पुष्टि या आवेदन भेजना नहीं है।',
  ].join(' ');
}

function worstSeverity(results: ValidationResult[]): Severity | null {
  for (const severity of severityOrder) {
    if (results.some((result) => result.severity === severity)) return severity;
  }
  return null;
}

export function Review({
  snapshot, results, summary, issues, pack, revealed, ackState, ackLabel, acknowledging,
  onAcknowledge, onGoToField, onNextIssue, onSpeak, onStop,
}: {
  snapshot: FormSnapshot;
  results: ValidationResult[];
  summary: ReviewSummary;
  issues: ValidationResult[];
  pack: RulePack | null;
  revealed: ReadonlySet<string>;
  ackState: AckState;
  ackLabel: string | null;
  acknowledging: boolean;
  onAcknowledge: () => void;
  onGoToField: (fieldId: string) => void;
  onNextIssue: () => void;
  onSpeak: () => void;
  onStop: () => void;
}) {
  const mapped = new Set(pack?.fields.map((rule) => rule.key) ?? []);

  function rowStatus(field: FormField): string {
    const own = results.filter((result) => result.fieldId === field.fieldId);
    const worst = worstSeverity(own);
    if (worst !== null) return severityText[worst];
    if (!mapped.has(field.key)) return 'नियम पैक में नहीं — जाँचा नहीं गया';
    return 'कोई कमी नहीं मिली — पुष्टि नहीं';
  }

  return (
    <section aria-labelledby="review-heading" className="space-y-5">
      <h2 id="review-heading" className="text-xl font-bold">समीक्षा</h2>
      <p>
        जाँच स्थानीय नियमों से होती है और अधूरी है। समीक्षा पढ़ लेने का यह अर्थ नहीं कि पोर्टल आवेदन
        स्वीकार करेगा, कि पहचान सत्यापित हुई, या कि फ़ॉर्म भेजने लायक है।
      </p>

      <section aria-labelledby="summary-heading" className="space-y-3">
        <h3 id="summary-heading" className="text-lg font-bold">सार</h3>
        <p>
          {snapshot.fields.length} फ़ील्ड पढ़े गए · {summary.errors} सुधार · {summary.confirmations} पुष्टि ·{' '}
          {summary.unchecked} जाँचा नहीं गया (इनमें {summary.permanentLimits} स्थायी सीमाएँ)
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onNextIssue} aria-disabled={issues.length === 0} className={button}>
            अगली समस्या ({issues.length})
          </button>
          <button type="button" onClick={onSpeak} className={button}>समीक्षा सुनें</button>
          <button type="button" onClick={onStop} className={button}>सुनना रोकें</button>
        </div>
      </section>

      <section aria-labelledby="status-heading" className="space-y-3 border-l-4 border-teal-900 pl-4">
        <h3 id="status-heading" className="text-lg font-bold">स्थिति</h3>
        <p>{reviewStatusText(ackState, summary)}</p>
        {summary.blockers.length === 0 ? null : (
          <ul className="space-y-1">
            {summary.blockers.map((blocker, index) => <li key={`${blocker}-${index}`}>रुकावट: {blocker}</li>)}
          </ul>
        )}
        <p className="text-sm">
          पढ़ने की स्वीकृति: {ackState === 'none' ? 'दर्ज नहीं।' : ackState === 'current' ? `दर्ज — ${ackLabel}।` : `पुरानी (${ackLabel}); अब मान्य नहीं।`}
        </p>
        <p className="text-sm">
          आवेदन भेजना: इसका कोई भरोसेमंद प्रमाण पैनल के पास नहीं है। पैनल कभी नहीं भेजता, न Submit दबाता है, न
          CAPTCHA हल करता है; ये सब आपके हाथ में रहते हैं।
        </p>
        <button
          type="button"
          onClick={onAcknowledge}
          aria-disabled={acknowledging}
          aria-describedby="acknowledge-help"
          className={button}
        >
          मैंने दिखाई गई समीक्षा पढ़ ली है
        </button>
        <p id="acknowledge-help" className="text-sm">
          दबाने पर फ़ॉर्म तुरंत फिर पढ़ा जाता है, और स्वीकृति उसी जानकारी से जुड़ती है जो यहाँ दिखी है। बाद में
          कोई मान, नियम या संदर्भ बदले तो स्वीकृति अपने आप अमान्य हो जाती है।
        </p>
      </section>

      <section aria-labelledby="entered-heading" className="space-y-3">
        <h3 id="entered-heading" className="text-lg font-bold">दर्ज जानकारी</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">हर फ़ील्ड का दर्ज मान और उसकी जाँच का नतीजा</caption>
            <thead>
              <tr className="border-b-2 border-stone-400 text-left">
                <th scope="col" className="py-2 pr-3">फ़ील्ड</th>
                <th scope="col" className="py-2 pr-3">दर्ज मान</th>
                <th scope="col" className="py-2">नतीजा</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.fields.map((field) => {
                const value = fieldValue(field, revealed.has(field.fieldId));
                return (
                  <tr key={field.fieldId} className="border-b border-stone-300 align-top">
                    <th scope="row" className="py-2 pr-3 text-left font-bold">
                      <span lang={field.lang || undefined}>{field.label || noField}</span>
                      {field.group ? <span className="block font-normal">{field.group}</span> : null}
                    </th>
                    <td className="py-2 pr-3">
                      {value.prefix}
                      {value.value === null ? null : <> <span lang={field.lang || undefined}>{value.value}</span></>}
                    </td>
                    <td className="py-2">{rowStatus(field)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {severityOrder.map((severity) => {
        const matching = results.filter((result) => result.severity === severity);
        return (
          <section key={severity} aria-labelledby={`review-${severity}`} className="space-y-3 border-l-4 border-amber-700 pl-4">
            <h3 id={`review-${severity}`} className="text-lg font-bold">
              {severityText[severity]} ({matching.length})
            </h3>
            {matching.length === 0 ? (
              <p>अभी कोई नतीजा नहीं। इसका अर्थ “सब ठीक है” नहीं है।</p>
            ) : (
              <ul className="space-y-4">
                {matching.map((result, index) => (
                  <li key={`${result.ruleId}-${result.fieldId ?? 'page'}-${index}`} className="space-y-2">
                    <p>{result.message}</p>
                    <p className="text-sm">आगे क्या करें: {result.action}</p>
                    {result.source === null ? null : <p className="text-sm">स्रोत: {result.source}</p>}
                    {result.fieldId === null ? null : (
                      <button type="button" onClick={() => onGoToField(result.fieldId ?? '')} className={button}>
                        फ़ील्ड पर जाएँ
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </section>
  );
}
