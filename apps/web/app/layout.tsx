import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'फ़ॉर्म साथी', template: '%s — फ़ॉर्म साथी' },
  description: 'Hindi side-panel assistance for understanding, navigating and reviewing government forms with a screen reader. Independent project; not a government service.',
};

const nav = [
  ['/', 'परिचय'],
  ['/install', 'इंस्टॉल'],
  ['/guide', 'कीबोर्ड और NVDA'],
  ['/practice', 'अभ्यास फ़ॉर्म'],
  ['/workflows', 'समर्थित कार्यप्रवाह'],
  ['/privacy', 'गोपनीयता'],
  ['/limitations', 'सीमाएँ'],
  ['/results', 'परिणाम'],
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi">
      <body className="font-sans">
        <a href="#main" className="absolute -top-32 left-4 z-10 bg-white p-3 focus:top-4">मुख्य सामग्री पर जाएँ</a>
        <header className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-4 border-b-2 border-line px-6 py-5">
          <Link href="/" className="font-bold no-underline">फ़ॉर्म साथी</Link>
          <nav aria-label="मुख्य">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {nav.map(([href, label]) => (
                <li key={href}><Link href={href} className="text-teal underline-offset-4">{label}</Link></li>
              ))}
            </ul>
          </nav>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl border-t border-line px-6 py-5 text-sm">
          स्वतंत्र परियोजना · किसी सरकारी संस्था से संबद्ध नहीं · पात्रता, पहचान या स्वीकृति का सत्यापन नहीं ·{' '}
          <span lang="en">Independent project, not a government service.</span>
        </footer>
      </body>
    </html>
  );
}
