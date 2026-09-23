'use client';
import { IconUser } from '../icons';
import { useSession } from './SessionProvider';

// Header account control (clean icon + label). Shows the signed-in first name,
// otherwise the account label; the whole control links to /conta.
export function AccountLink({
  label,
  hello,
  signIn,
}: {
  label: string;
  hello?: string;
  signIn?: string;
}) {
  const { user } = useSession();
  void hello;
  void signIn;
  const firstName = user ? (user.displayName.split(' ')[0] ?? '') : '';
  return (
    <a className="wlact" href="/conta" aria-label={label}>
      <IconUser width={22} height={22} />
      <span className="wlact__label wlact__label--hide-sm">{firstName || label}</span>
    </a>
  );
}
