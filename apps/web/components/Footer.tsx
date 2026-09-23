import { IconMapPin } from './icons';
import type { Dictionary } from '../lib/i18n/index';

// Site footer, Wallapop-structured in Nhonga's own green/black/yellow: a brand
// block (wordmark + tagline + payment methods) beside the link columns, then a
// slim legal bar with a back-to-top link. Server component, no client JS.
export function Footer({ t }: { t: Dictionary }) {
  const f = t.footer;
  const columns = [
    {
      title: f.col_shop,
      links: [
        { label: f.link_all, href: '/pesquisa' },
        { label: f.link_deals, href: '/pesquisa?sort=price_asc' },
        { label: f.link_categories, href: '/' },
      ],
    },
    {
      title: f.col_sell,
      links: [
        { label: f.link_start_selling, href: '/vender/comecar' },
        { label: f.link_dashboard, href: '/vender' },
        { label: f.link_new_listing, href: '/vender/novo' },
      ],
    },
    {
      title: f.col_help,
      links: [
        { label: f.link_help, href: '/ajuda' },
        { label: f.link_messages, href: '/mensagens' },
        { label: f.link_design, href: '/estilo' },
      ],
    },
    {
      title: f.col_account,
      links: [
        { label: f.link_account, href: '/conta' },
        { label: f.link_signin, href: '/entrar' },
      ],
    },
  ];

  const wallets = f.payments
    .replace(/^[^:]*:\s*/, '')
    .split('·')
    .map((w) => w.trim());

  return (
    <footer className="wlftr">
      <div className="wlftr__inner">
        <div className="wlftr__brandcol">
          <span className="wlftr__brand">
            Nhonga<b>.</b>
          </span>
          <p className="wlftr__tagline">{f.tagline}</p>
          <ul className="wlftr__pay" aria-label={f.payments}>
            {wallets.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>

        <div className="wlftr__cols">
          {columns.map((col) => (
            <nav className="wlftr__col" key={col.title} aria-label={col.title}>
              <h2 className="wlftr__col-title">{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="wlftr__bar">
        <span className="wlftr__country">
          <IconMapPin width={14} height={14} aria-hidden /> Moçambique
        </span>
        <span className="wlftr__rights">{f.rights}</span>
        <a className="wlftr__top" href="#top">
          {f.back_to_top} ↑
        </a>
      </div>
    </footer>
  );
}
