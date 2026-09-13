import { useRef } from 'react';
import { translator, type FormSnapshot, type Translator } from '@form-saathi/contracts';
import type { ReviewSummary, RulePack, Severity, ValidationResult } from '@form-saathi/rules';
import { useLocale } from '../../../../packages/ui/Locale';
import { fieldValue } from './fields';

export type AckState = 'none' | 'current' | 'stale';
const severityOrder: Severity[] = ['error', 'needs-confirmation', 'unchecked'];
export function reviewStatusText(ackState: AckState, summary: ReviewSummary, t: Translator = translator()): string {
  if (ackState === 'none') return t('review.ackNone');
  if (ackState === 'stale') return t('review.stale');
  return t(`review.${summary.outcome}`, { count: summary.outcome === 'corrections-pending' ? summary.errors : summary.outcome === 'confirmation-needed' ? summary.confirmations : summary.permanentLimits });
}
export function spokenReview(summary: ReviewSummary, ackState: AckState, issues: ValidationResult[], t: Translator = translator()): string {
  return [t('review.heading'), reviewStatusText(ackState, summary, t), t('review.countsText', { errors: summary.errors, confirmations: summary.confirmations, unchecked: summary.unchecked }),
    ...issues.map((issue, index) => t('review.issue', { current: index + 1, total: issues.length, message: issue.message })), t('review.disclaimer')].join(' ');
}

export function Review({ snapshot, results, summary, issues, pack, revealed, ackState, ackLabel, acknowledging,
  onAcknowledge, onGoToField, onNextIssue, onSpeak, onStop,
}: {
  snapshot: FormSnapshot; results: ValidationResult[]; summary: ReviewSummary; issues: ValidationResult[];
  pack: RulePack | null; revealed: ReadonlySet<string>; ackState: AckState; ackLabel: string | null; acknowledging: boolean;
  onAcknowledge: () => void; onGoToField: (fieldId: string) => void; onNextIssue: () => void; onSpeak: () => void; onStop: () => void;
}) {
  const { t, locale } = useLocale();
  const details = useRef<HTMLDetailsElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mapped = new Set(pack?.fields.map((rule) => rule.key) ?? []);
  return <section aria-labelledby="review-heading" className="review stack">
    <h2 id="review-heading">{t('review.heading')}</h2>
    <dl className="review-counts">
      <div><dt>{t('review.errors')}</dt><dd>{summary.errors}</dd></div>
      <div><dt>{t('review.confirmations')}</dt><dd>{summary.confirmations}</dd></div>
      <div><dt>{t('review.unchecked')}</dt><dd>{summary.unchecked}</dd></div>
    </dl>
    <button type="button" className="button review-button" onClick={() => { if (details.current) details.current.open = true; heading.current?.focus(); }}>{t('review.open')}</button>
    <details ref={details}><summary>{t('review.issues')}</summary><div className="stack detail-body">
      <h3 ref={heading} tabIndex={-1}>{t('review.heading')}</h3>
      <p>{t('review.summary', { fields: snapshot.fields.length, errors: summary.errors, confirmations: summary.confirmations, unchecked: summary.unchecked, limits: summary.permanentLimits })}</p>
      <p>{t('review.disclaimer')}</p>
      <div className="actions"><button type="button" onClick={onNextIssue} aria-disabled={!issues.length} className="button">{t('review.next', { count: issues.length })}</button><button type="button" onClick={onSpeak} className="button">{t('speech.review')}</button><button type="button" onClick={onStop} className="button">{t('speech.stop')}</button></div>
      <section aria-labelledby="status-heading" className="stack acknowledgement">
        <h3 id="status-heading">{t('review.status')}</h3><p>{reviewStatusText(ackState, summary, t)}</p>
        {summary.blockers.length ? <ul>{summary.blockers.map((blocker, i) => <li key={i} dir="auto">{blocker}</li>)}</ul> : null}
        <p className="small">{t('review.receipt', { label: ackState === 'none' ? t('review.receiptNone') : t(ackState === 'current' ? 'review.receiptCurrent' : 'review.receiptStale', { revision: ackLabel ?? '' }) })}</p>
        <p className="small">{t('review.manual')}</p>
        <button type="button" className="button" onClick={onAcknowledge} aria-disabled={acknowledging} aria-describedby="acknowledge-help">{t('review.ack')}</button>
        <p id="acknowledge-help" className="small">{t('review.ackHelp')}</p>
      </section>
      {severityOrder.map((severity) => {
        const matching = results.filter((result) => result.severity === severity);
        return <section key={severity} aria-labelledby={`review-${severity}`} className="stack">
          <h3 id={`review-${severity}`}>{t(`severity.${severity}`)} ({matching.length})</h3>
          {!matching.length ? <p className="small muted">{t('review.noResults')}</p> : <ul className="issue-list">{matching.map((result, index) => <li key={`${result.ruleId}-${result.fieldId}-${index}`} className={`issue ${severity}`}>
            <p dir="auto">{result.message}</p><p>{t('nextAction')} {result.action}</p>
            {result.source ? <p className="small muted">{t('source')} <bdi>{result.source === 'page-required' ? t('source.page-required') : result.source}</bdi></p> : null}
            {result.fieldId ? <button type="button" className="button" onClick={() => onGoToField(result.fieldId!)}>{t('field.go')}</button> : null}
          </li>)}</ul>}
        </section>;
      })}
      <details><summary>{t('review.entered')}</summary><table className="entered-table"><caption>{t('review.entered')}</caption><thead><tr><th scope="col">{t('web.field')}</th><th scope="col">{t('value.label')}</th><th scope="col">{t('review.status')}</th></tr></thead><tbody>
        {snapshot.fields.map((field) => {
          const value = fieldValue(field, revealed.has(field.fieldId), t);
          const worst = severityOrder.find((severity) => results.some((result) => result.fieldId === field.fieldId && result.severity === severity));
          return <tr key={field.fieldId}><th scope="row"><strong lang={field.label ? field.labelLang || field.lang || undefined : locale} dir="auto">{field.label || t('field.unlabelled')}</strong></th><td>{value.prefix} <bdi lang={field.lang || undefined}>{value.value}</bdi></td><td className="small">{worst ? t(`severity.${worst}`) : t(mapped.has(field.key) ? 'review.noIssue' : 'review.unmapped')}</td></tr>;
        })}
      </tbody></table></details>
    </div></details>
  </section>;
}
