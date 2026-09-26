'use client';
import { useRouter } from 'next/navigation';
import { pt } from '../../lib/i18n/pt';
import {
  IconUser,
  IconShield,
  IconChevronLeft,
  IconHeart,
  IconChat,
  IconBell,
} from '../../components/icons';
import { useSession } from '../../components/auth/SessionProvider';

// Account (classifieds). Signed in (phone OTP) → greeting + shortcuts; otherwise
// a sign-in prompt. No orders — buying happens off-platform via the seller.
export default function AccountPage() {
  const t = pt.account;
  const router = useRouter();
  const { user, loading, signOut } = useSession();

  return (
    <section className="account">
      <h1 className="section__title">{t.title}</h1>

      {loading ? (
        <div className="empty" role="status">
          <p>{pt.common.loading}</p>
        </div>
      ) : user ? (
        <SignedIn
          name={user.displayName}
          phone={user.phoneE164}
          onSignOut={async () => {
            await signOut();
            router.refresh();
          }}
        />
      ) : (
        <Guest />
      )}
    </section>
  );
}

function SignedIn({
  name,
  phone,
  onSignOut,
}: {
  name: string;
  phone: string;
  onSignOut: () => void;
}) {
  const t = pt.account;
  return (
    <>
      <div className="card account__hello">
        <span className="account__icon" aria-hidden="true">
          <IconUser width={24} height={24} />
        </span>
        <div style={{ flex: 1 }}>
          <h2 className="card__title" style={{ marginBottom: 2 }}>
            {t.greeting.replace('{name}', name.split(' ')[0] ?? name)}
          </h2>
          <p className="account__muted">{phone}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ maxWidth: 160 }}
          onClick={onSignOut}
        >
          {t.sign_out}
        </button>
      </div>
      <Shortcuts />
    </>
  );
}

function Guest() {
  const t = pt.account;
  return (
    <>
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
      <Shortcuts />
    </>
  );
}

function Shortcuts() {
  const t = pt.account;
  const links = [
    { href: '/vender/comecar', icon: <IconUser width={20} height={20} />, label: t.link_sell },
    { href: '/favoritos', icon: <IconHeart width={20} height={20} />, label: t.link_favorites },
    { href: '/pesquisas', icon: <IconBell width={20} height={20} />, label: t.link_saved },
    { href: '/mensagens', icon: <IconChat width={20} height={20} />, label: t.link_messages },
    { href: '/ajuda', icon: <IconShield width={20} height={20} />, label: t.link_help },
  ];
  return (
    <>
      <h2 className="card__title" style={{ marginTop: 'var(--space-2)' }}>
        {t.links_title}
      </h2>
      <nav className="account__links" aria-label={t.links_title}>
        {links.map((l) => (
          <a key={l.href} className="account__link" href={l.href}>
            {l.icon}
            <span>{l.label}</span>
            <IconChevronLeft width={16} height={16} className="account__link-arrow" />
          </a>
        ))}
      </nav>
    </>
  );
}
