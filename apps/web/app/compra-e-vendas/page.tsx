import type { Metadata } from 'next';
import {
  IconKey,
  IconShirt,
  IconDevice,
  IconPhone,
  IconHome,
  IconCup,
  IconSparkle,
} from '../../components/icons';
import { FORSALE_KEYS, type ForSaleKey } from '../../lib/nav';
import { getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: `${t.forsale.title} — ${t.common.brand}`, description: t.forsale.subtitle };
}

const ICONS: Record<ForSaleKey, typeof IconKey> = {
  imoveis: IconKey,
  moda: IconShirt,
  electronica: IconDevice,
  telemoveis: IconPhone,
  casa: IconHome,
  alimentacao: IconCup,
  beleza: IconSparkle,
};

// "Compra e Vendas" (For Sale) section hub — the everyday-goods categories as
// tiles, Gumtree-style. Each links to its own filtered category page.
export default async function ForSalePage() {
  const { t } = await getDictionary();

  return (
    <section className="section" aria-labelledby="forsale-title">
      <nav className="crumbs" aria-label="breadcrumb">
        <span className="crumbs__item">
          <a href="/">{t.common.brand}</a>
          <span className="crumbs__sep" aria-hidden="true">
            /
          </span>
        </span>
        <span className="crumbs__item">
          <span aria-current="page">{t.forsale.title}</span>
        </span>
      </nav>

      <h1 className="section__title" id="forsale-title">
        {t.forsale.title}
      </h1>
      <p className="spotpage__lead">{t.forsale.subtitle}</p>

      <div className="hubgrid">
        {FORSALE_KEYS.map((k) => {
          const Icon = ICONS[k];
          return (
            <a className="hubtile" key={k} href={`/categoria/${k}`}>
              <span className="hubtile__icon" aria-hidden="true">
                <Icon width={28} height={28} />
              </span>
              <span className="hubtile__label">{t.categories[k]}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
