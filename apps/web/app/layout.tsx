import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { translator } from '@form-saathi/contracts';
import { LocaleProvider } from '../../../packages/ui/Locale';
import { SiteFrame } from '../lib/SiteFrame';
import './globals.css';

export const metadata: Metadata = {
  title: 'Form Saathi',
  description: translator()('app.description'),
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" dir="ltr"><body><LocaleProvider><SiteFrame>{children}</SiteFrame></LocaleProvider></body></html>;
}
