'use client';
import { useLocale } from '../../../packages/ui/Locale';
import type { ResultsData } from './results';
export function ResultsView({ data }: { data: ResultsData }) {
  const { t, locale } = useLocale();
  const metrics = [['sessions', 'web.sessions'], ['participants', 'web.participants'], ['completed', 'web.completed'], ['meanDurationSeconds', 'web.duration'], ['meanRemainingErrors', 'web.remaining'], ['meanFalseWarnings', 'web.false'], ['meanMissedErrors', 'web.missed'], ['assistanceEvents', 'web.assistance'], ['unclearWording', 'web.unclear'], ['captchaBlockers', 'web.captcha']] as const;
  return <article className="prose stack"><h1>{t('web.results')}</h1><p>{t('web.resultsIntro')}</p>
    {data.state === 'empty' ? <section className="notice stack"><h2>{t('web.noResults')}</h2><p>{t('web.noResultsText')}</p></section> : null}
    {data.state === 'invalid' ? <section className="notice stack"><h2>{t('web.invalidResults')}</h2><bdi dir="ltr">{data.file}</bdi><p>{t('web.resultsProblems')}</p><ul>{data.problems.map((problem, index) => <li key={index}><bdi dir="ltr">{problem.split(':')[0]}</bdi></li>)}</ul></section> : null}
    {data.state === 'loaded' ? data.summary.map((row) => <section key={row.condition} className="stack"><h2>{t(`web.condition${row.condition}`)}</h2><dl className="definition-list">{metrics.map(([property, label]) => <div key={property}><dt>{t(label)}</dt><dd>{row[property] === null ? t('web.na') : new Intl.NumberFormat(locale).format(row[property])}</dd></div>)}</dl></section>) : null}
  </article>;
}
