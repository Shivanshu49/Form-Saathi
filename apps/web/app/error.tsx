'use client';
import Link from 'next/link';
import { useLocale } from '../../../packages/ui/Locale';
export default function PageError({ reset }: { reset: () => void }) {
  const { t } = useLocale();
  return <article className="prose stack"><h1>{t('web.pageError')}</h1><div className="actions"><button type="button" className="button" onClick={reset}>{t('web.retry')}</button><Link href="/" className="button">{t('web.home')}</Link></div></article>;
}
