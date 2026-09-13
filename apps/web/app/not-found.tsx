'use client';
import Link from 'next/link';
import { useLocale } from '../../../packages/ui/Locale';
export default function NotFound() {
  const { t } = useLocale();
  return <article className="prose stack"><h1>{t('web.notFound')}</h1><p>{t('web.notFoundText')}</p><Link href="/" className="button">{t('web.home')}</Link></article>;
}
