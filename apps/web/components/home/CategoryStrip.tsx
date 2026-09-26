import { IconCar, IconBag, IconTools, IconBriefcase, IconTicket } from '../icons';
import type { Dictionary } from '../../lib/i18n/index';

// Gumtree-style pillar launcher: the verticals stand alone and everyday goods
// sit under one "Compra e Vendas" (For Sale) tile → /compra-e-vendas.
// Horizontally scrollable on phones.
const PILLARS = [
  { key: 'viaturas', href: '/categoria/viaturas', Icon: IconCar },
  { key: 'compra_vendas', href: '/compra-e-vendas', Icon: IconBag },
  { key: 'servicos', href: '/categoria/servicos', Icon: IconTools },
  { key: 'empregos', href: '/categoria/empregos', Icon: IconBriefcase },
  { key: 'eventos', href: '/categoria/eventos', Icon: IconTicket },
] as const;

export function CategoryStrip({ t }: { t: Dictionary }) {
  return (
    <nav className="catstrip" aria-label={t.home.shop_by_category}>
      {PILLARS.map(({ key, href, Icon }) => (
        <a className="catstrip__item" key={key} href={href}>
          <span className="catstrip__icon" aria-hidden="true">
            <Icon width={26} height={26} />
          </span>
          <span className="catstrip__label">{t.categories[key]}</span>
        </a>
      ))}
    </nav>
  );
}
