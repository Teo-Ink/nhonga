'use client';
import { IconUser } from '../icons';
import { useSession } from './SessionProvider';

// Header account control. Shows the signed-in user's first name next to the
// icon; otherwise it is just the account icon linking to /conta (which offers
// sign-in). Purely presentational — auth state comes from the session.
export function AccountLink({ label }: { label: string }) {
  const { user } = useSession();
  const firstName = user ? (user.displayName.split(' ')[0] ?? '') : '';
  return (
    <a className="iconbtn iconbtn--account" href="/conta" aria-label={label}>
      <IconUser />
      {firstName ? <span className="iconbtn__name">{firstName}</span> : null}
    </a>
  );
}
