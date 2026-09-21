'use client';
import { IconUser } from '../icons';
import { useSession } from './SessionProvider';

// Header account control (Amazon-structured two-line label, Nhonga's look):
// "Olá, {name}" / "Conta" when signed in, "Olá, Entrar" / "Conta" otherwise.
// Auth state comes from the session; the whole control links to /conta.
export function AccountLink({
  label,
  hello,
  signIn,
}: {
  label: string;
  hello: string;
  signIn: string;
}) {
  const { user } = useSession();
  const firstName = user ? (user.displayName.split(' ')[0] ?? '') : '';
  return (
    <a className="iconbtn iconbtn--account" href="/conta" aria-label={label}>
      <IconUser />
      <span className="account-link__text">
        <span className="account-link__hi">
          {hello}, {firstName || signIn}
        </span>
        <span className="account-link__label">{label}</span>
      </span>
    </a>
  );
}
