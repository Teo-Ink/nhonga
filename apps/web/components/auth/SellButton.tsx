'use client';
import { IconPlus } from '../icons';
import { useSession } from './SessionProvider';

// The header "Vender" button. Selling requires an account, so this gates on the
// session: signed-in users go straight to the seller onboarding, while everyone
// else is sent to /entrar (create account for new users, sign in for existing)
// with a `next` back to the selling flow. While the session is still loading we
// point at /entrar, which itself bounces already-authenticated users onward.
export function SellButton({ label }: { label: string }) {
  const { user } = useSession();
  const href = user ? '/vender/comecar' : '/entrar?next=/vender/comecar';
  return (
    <a className="wlsell" href={href}>
      <IconPlus width={18} height={18} />
      <span>{label}</span>
    </a>
  );
}
