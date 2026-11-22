import type { Dictionary } from '../lib/i18n/index';

// Thin promotional strip above the header (Alibaba-structured, Nhonga's look and
// copy). Honest, no fabricated urgency — a welcome line and a sell CTA.
export function PromoBar({ t }: { t: Dictionary }) {
  return (
    <div className="promobar">
      <div className="promobar__inner">
        <span>{t.home.promo_text}</span>
        <a className="promobar__cta" href="/vender/novo">
          {t.home.promo_cta} →
        </a>
      </div>
    </div>
  );
}
