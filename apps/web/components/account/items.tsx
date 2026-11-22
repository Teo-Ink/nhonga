import type { ReactNode } from 'react';
import {
  IconGrid,
  IconPlus,
  IconStar,
  IconWallet,
  IconChat,
  IconUser,
  IconHeart,
  IconBell,
  IconGift,
  IconShield,
} from '../icons';
import type { Dictionary } from '../../lib/i18n/index';

export interface AccountItem {
  href: string;
  label: string;
  icon: ReactNode;
}
export interface AccountGroup {
  title: string;
  items: AccountItem[];
}

const sz = { width: 18, height: 18 } as const;

// The account menu, shaped by whether the user sells (has a shop) or only buys.
// Shared by the header "A tua conta" dropdown and the /conta sidebar so the two
// never drift.
export function accountGroups(t: Dictionary['account'], isSeller: boolean): AccountGroup[] {
  const mine: AccountItem[] = isSeller
    ? [
        { href: '/vender', label: t.m_my_ads, icon: <IconGrid {...sz} /> },
        { href: '/vender/novo', label: t.m_new_ad, icon: <IconPlus {...sz} /> },
        { href: '/vender/promover', label: t.m_promote, icon: <IconStar {...sz} /> },
        { href: '/vender/planos', label: t.m_plans, icon: <IconWallet {...sz} /> },
        { href: '/mensagens', label: t.link_messages, icon: <IconChat {...sz} /> },
      ]
    : [
        { href: '/mensagens', label: t.link_messages, icon: <IconChat {...sz} /> },
        { href: '/vender/novo', label: t.link_sell, icon: <IconUser {...sz} /> },
      ];
  return [
    { title: t.menu_account, items: mine },
    {
      title: t.menu_favorites,
      items: [
        { href: '/favoritos', label: t.link_favorites, icon: <IconHeart {...sz} /> },
        { href: '/pesquisas', label: t.link_saved, icon: <IconBell {...sz} /> },
      ],
    },
    {
      title: t.menu_more,
      items: [
        { href: '/convidar', label: t.link_invite, icon: <IconGift {...sz} /> },
        { href: '/ajuda', label: t.link_help, icon: <IconShield {...sz} /> },
      ],
    },
  ];
}
