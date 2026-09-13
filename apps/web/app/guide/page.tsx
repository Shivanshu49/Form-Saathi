'use client';
import { useLocale } from '../../../../packages/ui/Locale';
export default function Guide() {
  const { t } = useLocale();
  const keys = [['Alt+Shift+F', 'web.keyOpen'], ['Tab / Shift+Tab', 'web.keyTab'], ['Enter / Space', 'web.keyActivate'], ['F6', 'field.return']] as const;
  return <article className="prose stack"><h1>{t('web.guide')}</h1><p>{t('web.zoom')}</p><table><caption>{t('web.keys')}</caption><thead><tr><th scope="col">{t('web.key')}</th><th scope="col">{t('web.action')}</th></tr></thead><tbody>{keys.map(([key, text]) => <tr key={key}><th scope="row"><kbd>{key}</kbd></th><td>{t(text)}</td></tr>)}</tbody></table>
    <section className="stack"><h2>{t('review.heading')}</h2><p>{t('help.text.review')}</p><p>{t('review.ackHelp')}</p></section>
    <section className="stack"><h2>{t('speech.heading')}</h2><p>{t('speech.localOnly')}</p><p>{t('value.revealFirst')}</p></section><p className="notice">{t('web.nvda')}</p>
  </article>;
}
