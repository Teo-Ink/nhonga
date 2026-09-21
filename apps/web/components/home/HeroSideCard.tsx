'use client';
import { IconUser, IconCheck } from '../icons';
import { useSession } from '../auth/SessionProvider';
import type { Dictionary } from '../../lib/i18n/index';

// Right-hand hero card (Alibaba-structured, Nhonga's look): a session-aware
// account panel — a sign-in prompt for guests, a welcome + quick links when
// signed in — over a short benefits list.
export function HeroSideCard({ t }: { t: Dictionary }) {
  const { user } = useSession();
  const h = t.home;
  const firstName = user ? (user.displayName.split(' ')[0] ?? '') : '';

  return (
    <aside className="herocard">
      <div className="herocard__account">
        <span className="herocard__avatar" aria-hidden="true">
          <IconUser width={22} height={22} />
        </span>
        {user ? (
          <>
            <p className="herocard__hi">
              {h.side_hi}, {firstName}!
            </p>
            <a className="btn btn--cta herocard__btn" href="/conta">
              {h.side_orders}
            </a>
            <a className="btn btn--ghost herocard__btn" href="/vender/comecar">
              {h.side_sell}
            </a>
          </>
        ) : (
          <>
            <p className="herocard__title">{h.side_guest_title}</p>
            <p className="herocard__body">{h.side_guest_body}</p>
            <a className="btn btn--cta herocard__btn" href="/entrar">
              {t.common.sign_in}
            </a>
          </>
        )}
      </div>

      <ul className="herocard__benefits">
        {[h.side_benefit1, h.side_benefit2, h.side_benefit3].map((b) => (
          <li key={b}>
            <IconCheck width={16} height={16} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
