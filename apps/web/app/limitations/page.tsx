'use client';
import { useLocale } from '../../../../packages/ui/Locale';
export default function Limitations() {
  const { t } = useLocale();
  return <article className="prose stack"><h1>{t('web.limitations')}</h1><ul className="limitations-list">{(['support.unverified', 'web.scopeText', 'web.coverage', 'web.validationLimits', 'review.manual', 'web.speechLimits', 'web.nvda', 'web.translationReview'] as const).map((key) => <li key={key}>{t(key)}</li>)}</ul></article>;
}
