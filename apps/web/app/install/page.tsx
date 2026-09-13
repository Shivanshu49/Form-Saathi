'use client';
import { useLocale } from '../../../../packages/ui/Locale';
export default function Install() {
  const { t } = useLocale();
  const permissions = [['sidePanel', 'web.permissionPanel'], ['activeTab, scripting', 'web.permissionTab'], ['tts', 'web.permissionTts'], ['storage', 'web.permissionStorage']] as const;
  return <article className="prose stack"><p className="eyebrow">{t('app.name')}</p><h1>{t('web.install')}</h1><p>{t('web.desktop')}</p><p>{t('web.installIntro')}</p>
    <a href="https://github.com/Shivanshu49/Form-Saathi">GitHub: Form Saathi</a>
    <ol className="install-steps">
      <li>{t('web.install1')} <code>form-saathiextension-0.1.0-chrome.zip</code></li>
      <li>{t('web.install2')} <code>chrome://extensions</code></li>
      <li>{t('web.install3')} <code>Load unpacked</code></li>
      <li>{t('web.install4')} <kbd>Alt+Shift+F</kbd></li>
    </ol>
    <p><code>npm run package:pilot</code></p>
    <section aria-labelledby="permissions-heading" className="stack"><h2 id="permissions-heading">{t('web.permissions')}</h2><dl className="definition-list">{permissions.map(([name, key]) => <div key={name}><dt><code>{name}</code></dt><dd>{t(key)}</dd></div>)}</dl></section>
    <section className="stack"><h2>{t('cloud.heading')}</h2><p>{t('web.localText')}</p><p className="small">{t('cloud.session')}</p></section>
  </article>;
}
