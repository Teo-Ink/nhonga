import {
  IconShirt,
  IconDevice,
  IconPhone,
  IconHome,
  IconCup,
  IconSparkle,
  IconCar,
  IconKey,
  IconBriefcase,
  IconTools,
  IconLeaf,
} from '../icons';
import type { Dictionary } from '../../lib/i18n/index';

// Classifieds verticals lead (Viaturas/Imóveis/Empregos/Serviços/Agro, in the
// spirit of an OLX/Gumtree top nav), then the "for sale" retail categories.
const CATS = [
  { slug: 'viaturas', Icon: IconCar },
  { slug: 'imoveis', Icon: IconKey },
  { slug: 'empregos', Icon: IconBriefcase },
  { slug: 'servicos', Icon: IconTools },
  { slug: 'agro', Icon: IconLeaf },
  { slug: 'moda', Icon: IconShirt },
  { slug: 'electronica', Icon: IconDevice },
  { slug: 'telemoveis', Icon: IconPhone },
  { slug: 'casa', Icon: IconHome },
  { slug: 'alimentacao', Icon: IconCup },
  { slug: 'beleza', Icon: IconSparkle },
] as const;

// Round category-icon strip (OLX-structured, Nhonga's look): the classifieds
// home's category launcher, horizontally scrollable on phones.
export function CategoryStrip({ t }: { t: Dictionary }) {
  return (
    <nav className="catstrip" aria-label={t.home.shop_by_category}>
      {CATS.map(({ slug, Icon }) => (
        <a className="catstrip__item" key={slug} href={`/categoria/${slug}`}>
          <span className="catstrip__icon" aria-hidden="true">
            <Icon width={26} height={26} />
          </span>
          <span className="catstrip__label">{t.categories[slug]}</span>
        </a>
      ))}
    </nav>
  );
}
