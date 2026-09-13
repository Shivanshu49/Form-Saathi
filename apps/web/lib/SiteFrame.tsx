'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LanguageSelect, useLocale } from '../../../packages/ui/Locale';
import { Icon } from '../../../packages/ui/Icon';

const nav = [['/install', 'web.install'], ['/practice', 'web.practice'], ['/workflows', 'web.workflows'], ['/guide', 'web.guide']] as const;
const footer = [['/privacy', 'web.privacy'], ['/limitations', 'web.limitations'], ['/results', 'web.results']] as const;
export function SiteFrame({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const path = usePathname();
  return <>
    <a href="#main" className="skip-link">{t('web.skip')}</a>
    <header className="site-header"><div className="site-header-top"><Link href="/" className="brand"><Icon name="mark" />{t('app.name')}</Link><LanguageSelect /></div>
      <nav aria-label={t('web.navigation')}><ul>{nav.map(([href, key]) => <li key={href}><Link href={href} aria-current={path === href ? 'page' : undefined}>{t(key)}</Link></li>)}</ul></nav>
    </header>
    <main id="main" tabIndex={-1} className="site-main">{children}</main>
    <footer className="site-footer"><p>{t('web.footer')}</p><div className="footer-links">{footer.map(([href, key]) => <Link key={href} href={href}>{t(key)}</Link>)}</div></footer>
  </>;
}
