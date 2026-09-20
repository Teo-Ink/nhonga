import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Nhonga — Compre e venda em Moçambique',
  description: 'O mercado online de Moçambique. Pague com M-Pesa, e-Mola ou na entrega.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <header className="site-header">
          <div className="site-header__bar">
            <a href="/" className="brand">
              Nhonga<span>.</span>
            </a>
            <input
              className="search"
              placeholder="Pesquisar produtos…"
              aria-label="Pesquisar"
              disabled
            />
          </div>
          <p className="tagline">
            Entregas em todo o país · M-Pesa · e-Mola · Pagamento na entrega
          </p>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
