'use client';
import Link from 'next/link';
import { useLocale } from '../../../packages/ui/Locale';
import { packs, livePortalSupport } from '../lib/content';
export default function Home() {
  const { t } = useLocale();
  return <article className="home">
    <header className="hero"><div className="hero-copy stack"><p className="eyebrow">{t('web.eyebrow')}</p><h1>{t('web.title')}</h1><p className="intro">{t('web.intro')}</p><div className="actions"><Link href="/install" className="button primary">{t('web.install')}</Link><Link href="/practice" className="button">{t('web.practice')}</Link></div><p className="small muted">{t('web.desktop')}</p></div>
      <aside className="start-note stack"><span className="eyebrow">{t('app.name')}</span><h2>{t('web.start')}</h2><p>{t('web.pilot')}</p><p>{t('web.localText')}</p><Link href="/guide">{t('web.guide')}</Link></aside>
    </header>
    <section className="workflow-steps" aria-labelledby="flow-heading"><h2 id="flow-heading">{t('web.flow')}</h2><ol>{(['read', 'navigate', 'review'] as const).map((step, i) => <li key={step}><span className="step-number" aria-hidden="true">0{i + 1}</span><h3>{t(`web.${step}Title`)}</h3><p>{t(`web.${step}`)}</p></li>)}</ol></section>
    <section className="scope-section" aria-labelledby="scope-heading"><div className="stack"><h2 id="scope-heading">{t('web.scope')}</h2><p>{t('web.scopeText')}</p><Link href="/workflows">{t('web.workflows')}</Link></div><dl className="workflow-status">{packs.map((pack) => <div key={pack.id}><dt>{t(`workflow.${pack.workflow}`)}</dt><dd>{t(`support.${livePortalSupport[pack.workflow]}`)}</dd></div>)}</dl></section>
  </article>;
}
