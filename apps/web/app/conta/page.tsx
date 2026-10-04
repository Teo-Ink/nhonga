'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pt } from '../../lib/i18n/pt';
import { IconUser, IconHeart, IconBell, IconChat, IconChevronLeft } from '../../components/icons';
import { useSession } from '../../components/auth/SessionProvider';
import { accountGroups } from '../../components/account/items';
import { MyShopPanel } from '../../components/vender/MyShopPanel';

// Account dashboard (MyOLX-structured): a left menu + a main area whose content
// depends on buyer vs seller. Sellers land on "Os meus anúncios"; buyers get an
// activity overview with a prompt to start selling. Signed out → a sign-in card.
export default function AccountPage() {
  const t = pt.account;
  const router = useRouter();
  const { user, shop, isSeller, loading, shopLoading, signOut } = useSession();

  if (loading || (user && shopLoading)) {
    return (
      <section className="account">
        <div className="empty" role="status">
          <p>{pt.common.loading}</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="account">
        <h1 className="section__title">{t.title}</h1>
        <div className="card account__signin">
          <span className="account__icon" aria-hidden="true">
            <IconUser width={24} height={24} />
          </span>
          <h2 className="card__title">{t.guest_title}</h2>
          <p className="account__muted">{t.guest_body}</p>
          <a className="btn btn--cta" href="/entrar">
            {t.sign_in}
          </a>
        </div>
      </section>
    );
  }

  const firstName = user.displayName.split(' ')[0] ?? user.displayName;
  const groups = accountGroups(t, isSeller);

  return (
    <section className="acctdash">
      <aside className="acctdash__side">
        <div className="acctdash__id">
          <span className="acctdash__avatar" aria-hidden="true">
            {(firstName[0] ?? 'U').toUpperCase()}
          </span>
          <div className="acctdash__idtext">
            <strong>{firstName}</strong>
            <span className="acctdash__phone">{user.phoneE164}</span>
            <span className={`acctdash__badge ${isSeller ? 'is-seller' : ''}`}>
              {isSeller ? t.seller_badge : t.buyer_badge}
            </span>
          </div>
        </div>

        <nav className="acctdash__nav" aria-label={t.menu_account}>
          {groups.map((g) => (
            <div className="acctdash__group" key={g.title}>
              <p className="acctdash__gtitle">{g.title}</p>
              {g.items.map((it) => (
                <a className="acctdash__link" href={it.href} key={it.href}>
                  {it.icon}
                  <span>{it.label}</span>
                  <IconChevronLeft width={15} height={15} className="acctdash__arrow" />
                </a>
              ))}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="btn btn--ghost acctdash__signout"
          onClick={async () => {
            await signOut();
            router.refresh();
          }}
        >
          {t.sign_out}
        </button>
      </aside>

      <div className="acctdash__main">
        {isSeller ? (
          <MyShopPanel />
        ) : (
          <BuyerOverview name={firstName} shopName={shop?.displayName} />
        )}
      </div>
    </section>
  );
}

// Buyer home: favourites + saved-search counts, quick links, and a prompt to
// start selling (which turns this account into the seller view).
function BuyerOverview({ name, shopName }: { name: string; shopName?: string }) {
  const t = pt.account;
  void shopName;
  const [counts, setCounts] = useState({ fav: 0, saved: 0 });
  useEffect(() => {
    const read = (k: string): number => {
      try {
        const v = JSON.parse(localStorage.getItem(k) ?? '[]') as unknown[];
        return Array.isArray(v) ? v.length : 0;
      } catch {
        return 0;
      }
    };
    setCounts({ fav: read('nhonga_favs'), saved: read('nhonga_saved_searches') });
  }, []);

  return (
    <div className="buyer">
      <div className="dash__head">
        <div>
          <h1 className="section__title">{t.greeting.replace('{name}', name)}</h1>
          <p className="account__muted">{t.buyer_overview_sub}</p>
        </div>
      </div>

      <div className="buyer__stats">
        <a className="buyer__stat" href="/favoritos">
          <IconHeart width={22} height={22} />
          <strong>{counts.fav}</strong>
          <span>{t.stat_favorites}</span>
        </a>
        <a className="buyer__stat" href="/pesquisas">
          <IconBell width={22} height={22} />
          <strong>{counts.saved}</strong>
          <span>{t.stat_saved}</span>
        </a>
        <a className="buyer__stat" href="/mensagens">
          <IconChat width={22} height={22} />
          <strong>—</strong>
          <span>{t.link_messages}</span>
        </a>
      </div>

      <div className="buyer__sell">
        <div>
          <h2 className="buyer__selltitle">{t.cta_sell_title}</h2>
          <p className="account__muted">{t.cta_sell_body}</p>
        </div>
        <a className="btn btn--cta" href="/vender/comecar">
          {t.cta_sell_btn}
        </a>
      </div>
    </div>
  );
}
