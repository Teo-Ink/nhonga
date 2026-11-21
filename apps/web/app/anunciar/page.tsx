import type { Metadata } from 'next';
import { IconMapPin, IconGrid, IconSparkle } from '../../components/icons';
import { AdBookingForm } from '../../components/AdBookingForm';
import { getAdPlans } from '../../lib/api';
import { FORSALE_KEYS, PILLAR_KEYS } from '../../lib/nav';
import { getDictionary } from '../../lib/i18n/index';
import { formatPrice } from '../../lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: `${t.ads.page_title} — ${t.common.brand}`, description: t.ads.page_subtitle };
}

// "Advertise on Nhonga" — the display-ad side of the revenue model. Example
// spaces and prices (clearly a demo). Private sellers are pointed to the
// self-serve boosts instead, so the two revenue streams stay distinct.
export default async function AdvertisePage() {
  const { t } = await getDictionary();
  const a = t.ads;
  const plans = await getAdPlans();
  const cats = [...PILLAR_KEYS, ...FORSALE_KEYS].map((k) => ({
    slug: k,
    label: (t.categories as Record<string, string>)[k] ?? k,
  }));

  const why = [
    { Icon: IconMapPin, title: a.why_reach, desc: a.why_reach_desc },
    { Icon: IconGrid, title: a.why_targeting, desc: a.why_targeting_desc },
    { Icon: IconSparkle, title: a.why_formats, desc: a.why_formats_desc },
  ];
  // Example daily rates from the live rate card (demo pricing).
  const formats = [
    { key: 'leaderboard', title: a.fmt_leaderboard, desc: a.fmt_leaderboard_desc },
    { key: 'inline', title: a.fmt_inline, desc: a.fmt_inline_desc },
    { key: 'mpu', title: a.fmt_mpu, desc: a.fmt_mpu_desc },
  ];

  return (
    <section className="section spotpage" aria-labelledby="spotpage-title">
      <nav className="crumbs" aria-label="breadcrumb">
        <span className="crumbs__item">
          <a href="/">{t.common.brand}</a>
          <span className="crumbs__sep" aria-hidden="true">
            /
          </span>
        </span>
        <span className="crumbs__item">
          <span aria-current="page">{a.page_title}</span>
        </span>
      </nav>

      <h1 className="section__title" id="spotpage-title">
        {a.page_title}
      </h1>
      <p className="spotpage__lead">{a.page_subtitle}</p>
      <p>
        <a className="section__link" href="/anunciar/painel">
          {a.panel_link} →
        </a>
      </p>
      <p className="notice" role="note">
        {a.demo_note}
      </p>

      <h2 className="spotpage__h2">{a.why_title}</h2>
      <ul className="spotpage__why">
        {why.map((w, i) => (
          <li className="spotwhy" key={i}>
            <span className="spotwhy__icon" aria-hidden="true">
              <w.Icon width={22} height={22} />
            </span>
            <span className="spotwhy__body">
              <strong>{w.title}</strong>
              <span>{w.desc}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="spotpage__h2">{a.formats_title}</h2>
      <div className="spotformats">
        {formats.map((f, i) => (
          <div className="spotfmt" key={i}>
            <div className={`spotfmt__preview spotfmt__preview--${i}`} aria-hidden="true">
              <span className="spotbox__label">{a.label}</span>
            </div>
            <h3 className="spotfmt__title">{f.title}</h3>
            <p className="spotfmt__desc">{f.desc}</p>
            <p className="spotfmt__price">
              <span className="spotfmt__from">{a.from_price}</span> {formatPrice(plans[f.key] ?? 0)}
              <span className="spotfmt__per">{a.per_day}</span>
            </p>
          </div>
        ))}
      </div>

      <AdBookingForm t={a} plans={plans} categories={cats} />

      <div className="spotboost">
        <div>
          <strong>{a.seller_boost_title}</strong>
          <p>{a.seller_boost_body}</p>
        </div>
        <a className="btn btn--ghost" href="/vender/promover">
          {a.seller_boost_cta}
        </a>
      </div>
    </section>
  );
}
