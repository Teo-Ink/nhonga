import type { Dictionary } from '../../lib/i18n/index';

// Post-a-free-ad banner (OLX-structured classifieds CTA, Nhonga's look). The
// business-model heart of a classifieds marketplace: anyone can list for free.
// NB: the class is "sellbar", not "postad" — a class named "…ad" trips
// ad-blocker cosmetic filters, which would hide this banner for real users.
export function PostAdBanner({ t }: { t: Dictionary }) {
  return (
    <section className="sellbar">
      <div className="sellbar__text">
        <h2 className="sellbar__title">{t.home.post_free}</h2>
        <p className="sellbar__sub">{t.home.post_free_sub}</p>
      </div>
      <a className="btn btn--cta sellbar__cta" href="/vender/novo">
        {t.home.post_free}
      </a>
    </section>
  );
}
