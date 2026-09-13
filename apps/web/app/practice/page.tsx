'use client';
import { useLocale } from '../../../../packages/ui/Locale';
import { practiceForms, practiceUrl, profiles } from '../../lib/content';
export default function Practice() {
  const { t } = useLocale();
  return <article className="stack"><h1>{t('web.practice')}</h1><p className="intro">{t('web.practiceIntro')}</p><p className="notice">{t('web.fictional')}</p><p>{t('web.practiceHelp')}</p>
    <div className="practice-grid">{practiceForms.map((form) => <section key={form.workflow} className="stack practice-workflow"><h2>{t(`workflow.${form.workflow}`)}</h2><p>{t('support.unverified')}</p><p className="small">{t('web.references')}: <bdi lang="en">A: {profiles[form.profile].a.reference}, B: {profiles[form.profile].b.reference}</bdi></p><ul>{(['a', 'b'] as const).map((variant) => <li key={variant}><a href={practiceUrl(form.page, variant, 'issues')}>{t('web.practiceIssue', { profile: variant.toUpperCase() })}</a><a href={practiceUrl(form.page, variant, 'complete')}>{t('web.practiceComplete', { profile: variant.toUpperCase() })}</a></li>)}</ul></section>)}</div>
    <p>{t('web.practiceRun')} <code>npm run dev:fixtures</code></p>
  </article>;
}
