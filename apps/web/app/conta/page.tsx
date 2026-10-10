'use client';
import { useEffect, useState } from 'react';
import { pt } from '../../lib/i18n/pt';
import { IconUser, IconHeart, IconBell, IconChat } from '../../components/icons';
import { useSession } from '../../components/auth/SessionProvider';
import { accountGroups } from '../../components/account/items';
import { MyShopPanel } from '../../components/vender/MyShopPanel';

// Account dashboard (MyOLX-structured): full-width content whose section depends
// on buyer vs seller. Account navigation lives in the header "A tua conta"
// dropdown (and, for sellers, the horizontal tabs inside the panel). Sellers
// land on "Os meus anúncios"; buyers get an activity overview. Signed out → a
// sign-in card.
export default function AccountPage() {
  const t = pt.account;
  const { user, shop, isSeller, loading, shopLoading } = useSession();

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

  return (
    <section className="acctpage">
      {isSeller ? (
        <MyShopPanel />
      ) : (
        <BuyerOverview name={firstName} shopName={shop?.displayName} />
      )}
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

      <div className="buyer__links">
        {accountGroups(t, false)
          .flatMap((g) => g.items)
          .map((it) => (
            <a className="buyer__link" href={it.href} key={it.href}>
              <span className="buyer__linkicon" aria-hidden="true">
                {it.icon}
              </span>
              <span className="buyer__linklabel">{it.label}</span>
            </a>
          ))}
      </div>
    </div>
  );
}
