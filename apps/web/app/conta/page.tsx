'use client';
import { pt } from '../../lib/i18n/pt';
import { IconUser } from '../../components/icons';
import { useSession } from '../../components/auth/SessionProvider';
import { MyShopPanel } from '../../components/vender/MyShopPanel';

// Account page. Buyers and sellers share one layout (MyOLX / "Os teus
// anúncios"): the panel adapts its header + empty state to whether the user
// has a shop yet. Account navigation lives in the header "A tua conta"
// dropdown, so there is no sidebar or duplicate shortcut list here.
export default function AccountPage() {
  const t = pt.account;
  const { user, loading } = useSession();

  if (loading) {
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

  return (
    <section className="acctpage">
      <MyShopPanel />
    </section>
  );
}
