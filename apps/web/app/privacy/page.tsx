'use client';
import { useLocale } from '../../../../packages/ui/Locale';
export default function Privacy() {
  const { t } = useLocale();
  return <article className="prose stack"><h1>{t('web.privacy')}</h1><section className="stack"><h2>{t('web.storage')}</h2><p>{t('privacy.local')}</p><p>{t('web.storageText')}</p><p>{t('reference.help')}</p></section>
    <section className="stack"><h2>{t('cloud.heading')}</h2><p>{t('cloud.consent')}</p><p>{t('speech.recordingHelp')}</p><p>{t('web.serverPrivacy')}</p><p>{t('cloud.session')}</p></section>
    <section className="stack"><h2>{t('speech.heading')}</h2><p>{t('speech.localOnly')}</p><p>{t('help.description')}</p></section><p className="notice">{t('web.neverUpload')}</p>
  </article>;
}
