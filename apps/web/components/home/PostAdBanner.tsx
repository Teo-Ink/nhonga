import type { Dictionary } from '../../lib/i18n/index';

// Post-a-free-ad banner (OLX-structured classifieds CTA, Nhonga's look). The
// business-model heart of a classifieds marketplace: anyone can list for free.
export function PostAdBanner({ t }: { t: Dictionary }) {
  return (
    <section className="postad">
      <div className="postad__text">
        <h2 className="postad__title">{t.home.post_free}</h2>
        <p className="postad__sub">{t.home.post_free_sub}</p>
      </div>
      <a className="btn btn--cta postad__cta" href="/vender/novo">
        {t.home.post_free}
      </a>
    </section>
  );
}
