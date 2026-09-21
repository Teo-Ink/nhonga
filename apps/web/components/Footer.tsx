import type { Dictionary } from '../lib/i18n/index';

// Site footer (Amazon-structured: back-to-top bar + link columns + brand/payments
// strip), in Nhonga's own look. Server component; the back-to-top uses a plain
// fragment link so no client JS is needed.
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

  return (
    <footer className="ftr">
      <a className="ftr__top" href="#top">
        {f.back_to_top}
      </a>

      <div className="ftr__cols">
        {columns.map((col) => (
          <nav className="ftr__col" key={col.title} aria-label={col.title}>
            <h2 className="ftr__col-title">{col.title}</h2>
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

      <div className="ftr__brandbar">
        <span className="ftr__brand">
          Nhonga<b>.</b>
        </span>
        <span className="ftr__tagline">{f.tagline}</span>
      </div>

      <div className="ftr__legal">
        <span>{f.payments}</span>
        <span>{f.rights}</span>
      </div>
    </footer>
  );
}
