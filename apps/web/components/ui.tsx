import { cents, formatMZN } from '@nhonga/shared';
import type { ReactNode } from 'react';
import { IconShield, IconStar, IconTruck, IconWallet } from './icons';
import type { Dictionary } from '../lib/i18n/index';

export function Price({ now, was, large }: { now: number; was?: number; large?: boolean }) {
  return (
    <div className="price">
      <span className={large ? 'price__now price__now--lg' : 'price__now'}>
        {formatMZN(cents(now))}
      </span>
      {was && was > now ? <span className="price__was">{formatMZN(cents(was))}</span> : null}
    </div>
  );
}

export function Rating({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return null;
  return (
    <span className="rating" aria-label={`${value.toFixed(1)} / 5`}>
      <IconStar width={13} height={13} />
      {value.toFixed(1)}
      {count ? (
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({count})</span>
      ) : null}
    </span>
  );
}

export function DealBadge({ percent }: { percent: number }) {
  return <span className="badge badge--deal badge--media">-{percent}%</span>;
}

export function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="badge badge--verified">
      <IconStar width={11} height={11} /> {label}
    </span>
  );
}

export function TrustStrip({ t }: { t: Dictionary }) {
  const items = [
    { ico: <IconShield />, t: t.trust.buyer_protection, d: t.trust.buyer_protection_desc },
    { ico: <IconWallet />, t: t.trust.secure_payment, d: t.trust.secure_payment_desc },
    { ico: <IconTruck />, t: t.trust.delivery, d: t.trust.delivery_desc },
  ];
  return (
    <div className="trust" role="list">
      {items.map((it, i) => (
        <div className="trust__item" role="listitem" key={i}>
          <span className="trust__ico">{it.ico}</span>
          <span>
            <span className="trust__t" style={{ display: 'block' }}>
              {it.t}
            </span>
            <span className="trust__d">{it.d}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Skeleton({
  h = 16,
  w = '100%',
  r,
}: {
  h?: number;
  w?: string | number;
  r?: number;
}) {
  return (
    <span
      className="skeleton"
      style={{ display: 'block', height: h, width: w, borderRadius: r }}
      aria-hidden
    />
  );
}

export function ProductGridSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div className="card" key={i}>
          <div className="card__media">
            <Skeleton h={0} w="100%" />
          </div>
          <div className="card__body">
            <Skeleton h={14} />
            <Skeleton h={14} w="70%" />
            <Skeleton h={18} w="50%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="empty" role="status">
      {icon}
      <p>{children}</p>
    </div>
  );
}
