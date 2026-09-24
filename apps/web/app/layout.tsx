import type { ReactNode } from 'react';
import { Inter, Ubuntu } from 'next/font/google';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { PromoBar } from '../components/PromoBar';
import { BottomNav } from '../components/BottomNav';
import { CartProvider } from '../components/cart/CartProvider';
import { SessionProvider } from '../components/auth/SessionProvider';
import { getDictionary } from '../lib/i18n/index';
import './globals.css';

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
  description: 'O mercado online de Moçambique. Pague com M-Pesa, e-Mola, mKesh ou na entrega.',
};

// Set the theme before first paint so there is no light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getDictionary();
  return (
    // The no-flash script sets data-theme on <html> before hydration, so the
    // server markup intentionally differs from the client here.
    <html lang={locale} className={`${inter.variable} ${ubuntu.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) mutate body
          before hydration; suppress the resulting attribute mismatch. */}
      <body suppressHydrationWarning>
        <span id="top" />
        <a href="#main" className="skip-link">
          {locale === 'pt' ? 'Saltar para o conteúdo' : 'Skip to content'}
        </a>
        <SessionProvider>
          <CartProvider>
            <PromoBar t={t} />
            <Header t={t} locale={locale} />
            <main id="main" className="container">
              {children}
            </main>
            <Footer t={t} />
            <BottomNav t={t} />
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
