'use client';
import { useLocale } from '../../../../packages/ui/Locale';
import { packs, livePortalSupport } from '../../lib/content';
export default function Workflows() {
  const { t } = useLocale();
  return <article className="stack"><h1>{t('web.workflows')}</h1><p>{t('web.scopeText')}</p><p>{t('support.unknown')}</p>
    <table className="pack-table"><caption>{t('web.packStatus')}</caption><thead><tr><th scope="col">{t('web.workflows')}</th><th scope="col">{t('web.pack')}</th><th scope="col">{t('web.live')}</th></tr></thead><tbody>{packs.map((pack) => <tr key={pack.id}><th scope="row">{t(`workflow.${pack.workflow}`)}</th><td><bdi dir="ltr">{pack.id} {pack.version}</bdi><p>{t('web.reviewed')}: <bdi dir="ltr">{pack.reviewed}</bdi></p></td><td>{t(`support.${livePortalSupport[pack.workflow]}`)}</td></tr>)}</tbody></table>
    {packs.map((pack) => <section key={pack.id} className="stack"><h2>{t(`workflow.${pack.workflow}`)}</h2><p className="small">{t('web.inventory')}</p><p>{t('web.hosts')}: <bdi dir="ltr">{pack.hosts.join(', ')}</bdi></p>
      <table><caption>{t('status.read', { count: pack.fields.length })}</caption><thead><tr><th scope="col">{t('web.field')}</th><th scope="col">{t('web.requirement')}</th><th scope="col">{t('web.source')}</th></tr></thead><tbody>{pack.fields.map((field) => <tr key={field.key}><th scope="row"><bdi dir="ltr">{field.key}</bdi></th><td><p>{t(`fieldMeaning.${field.meaning}`)}</p><p>{t(field.requirement)}</p>{field.when ? <p><bdi dir="ltr">{field.when.key} = {field.when.value}</bdi></p> : null}</td><td><bdi dir="ltr">{field.source}</bdi></td></tr>)}</tbody></table>
    </section>)}
  </article>;
}
