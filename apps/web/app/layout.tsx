import type { ReactNode } from 'react';
import { Inter, Ubuntu } from 'next/font/google';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { PromoBar } from '../components/PromoBar';
import { BottomNav } from '../components/BottomNav';
import { SessionProvider } from '../components/auth/SessionProvider';
import { DictProvider } from '../components/i18n/DictProvider';
import { ChatWidget } from '../components/support/ChatWidget';
import { PwaProvider } from '../components/pwa/PwaProvider';
import { getDictionary } from '../lib/i18n/index';
import './globals.css';
import './ux.css';

// Type system: Inter for body/UI (legibility for prices, forms, dense lists)
// and Ubuntu for headings/display (warmth + local character). next/font
// self-hosts both (no runtime request to Google) and exposes them via CSS
// variables that tokens.css maps to --font-sans / --font-display.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
const ubuntu = Ubuntu({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-ubuntu',
});

export const metadata = {
  title: 'Nhonga — Compre e venda em Moçambique',
  description:
    'O mercado online de Moçambique. Pague com M-Pesa, e-Mola, transferência bancária, Visa ou na entrega.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Nhonga',
  appleWebApp: { capable: true, statusBarStyle: 'default' as const, title: 'Nhonga' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180.png', sizes: '180x180' }],
  },
};

export const viewport = {
  // Browser/status bar = the header colour (tokens.css --header-bg).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#015e48' },
    { media: '(prefers-color-scheme: dark)', color: '#042e22' },
  ],
};

// Before first paint, restore the theme and the "poupar dados" preference so
// there is no flash of the wrong theme or of the hero video on data-saver.
const bootScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t){d.setAttribute('data-theme',t);}if(localStorage.getItem('nhonga:save-data')==='1'){d.setAttribute('data-save-data','on');}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getDictionary();
  return (
    // The no-flash script sets data-theme on <html> before hydration, so the
    // server markup intentionally differs from the client here.
    <html lang={locale} className={`${inter.variable} ${ubuntu.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) mutate body
          before hydration; suppress the resulting attribute mismatch. */}
      <body suppressHydrationWarning>
        <span id="top" />
        <a href="#main" className="skip-link">
          {locale === 'pt' ? 'Saltar para o conteúdo' : 'Skip to content'}
        </a>
        <DictProvider locale={locale}>
          <SessionProvider>
            <PromoBar t={t} />
            <Header t={t} locale={locale} />
            <main id="main" className="container">
              {children}
            </main>
            <Footer t={t} />
            <BottomNav t={t} />
            <ChatWidget t={t.assistant} />
            <PwaProvider t={t.pwa} />
          </SessionProvider>
        </DictProvider>
      </body>
    </html>
  );
}
