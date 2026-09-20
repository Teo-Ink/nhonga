import type { ReactNode } from 'react';
import { Header } from '../components/Header';
import { getDictionary } from '../lib/i18n/index';
import './globals.css';

export const metadata = {
  title: 'Nhonga — Compre e venda em Moçambique',
  description: 'O mercado online de Moçambique. Pague com M-Pesa, e-Mola, mKesh ou na entrega.',
};

// Set the theme before first paint so there is no light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getDictionary();
  return (
    <html lang={locale}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          {locale === 'pt' ? 'Saltar para o conteúdo' : 'Skip to content'}
        </a>
        <Header t={t} locale={locale} />
        <main id="main" className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
