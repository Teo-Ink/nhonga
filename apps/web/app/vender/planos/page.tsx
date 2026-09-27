import { IconCheck, IconChevronLeft } from '../../../components/icons';
import { getDictionary } from '../../../lib/i18n/index';

export const metadata = { title: 'Planos e destaques · Nhonga' };

// Monetization page (Gumtree-style classifieds model): listing is free, and
// sellers pay to *promote* a listing (per-ad boosts) or subscribe to a Pro shop.
// All pricing here is a clearly-labelled demo — no payment is wired.
export default async function PlansPage() {
  const { t } = await getDictionary();
  const p = t.plans;

  const boosts = [
    {
      name: p.free_name,
      price: p.free_price,
      unit: p.per_ad,
      desc: p.free_desc,
      benefits: [p.free_b1, p.free_b2, p.free_b3],
      popular: false,
      cta: p.start_free,
      href: '/vender/comecar',
    },
    {
      name: p.destaque_name,
      price: p.destaque_price,
      unit: p.per_ad,
      desc: p.destaque_desc,
      benefits: [p.destaque_b1, p.destaque_b2, p.destaque_b3],
      popular: true,
      cta: p.choose,
      href: '/vender/promover',
    },
    {
      name: p.turbo_name,
      price: p.turbo_price,
      unit: p.per_ad,
      desc: p.turbo_desc,
      benefits: [p.turbo_b1, p.turbo_b2, p.turbo_b3],
      popular: false,
      cta: p.choose,
      href: '/vender/promover',
    },
  ];

  const pro = [
    {
      name: p.pro_basic_name,
      price: p.pro_basic_price,
      unit: p.per_month,
      desc: p.pro_basic_desc,
      benefits: [p.pro_basic_b1, p.pro_basic_b2, p.pro_basic_b3],
      highlight: false,
      cta: p.start_free,
    },
    {
      name: p.pro_pro_name,
      price: p.pro_pro_price,
      unit: p.per_month,
      desc: p.pro_pro_desc,
      benefits: [p.pro_pro_b1, p.pro_pro_b2, p.pro_pro_b3, p.pro_pro_b4],
      highlight: true,
      cta: p.go_pro,
      href: '/vender/verificar',
    },
  ];

  const how = [p.how_1, p.how_2, p.how_3];

  return (
    <section className="plans">
      <a className="pdp__back" href="/vender">
        <IconChevronLeft /> {p.back_sell}
      </a>

      <header className="plans__head">
        <h1 className="section__title">{p.title}</h1>
        <p className="account__muted">{p.subtitle}</p>
        <p className="demo-banner" role="note">
          {p.demo_note}
        </p>
      </header>

      {/* Per-ad boosts */}
      <div className="plans__section-head">
        <h2 className="card__title">{p.boosts_title}</h2>
        <p className="account__muted">{p.boosts_sub}</p>
      </div>
      <div className="plans__grid">
        {boosts.map((tier) => (
          <article
            key={tier.name}
            className={`plancard ${tier.popular ? 'plancard--featured' : ''}`}
          >
            {tier.popular ? <span className="plancard__ribbon">{p.popular}</span> : null}
            <h3 className="plancard__name">{tier.name}</h3>
            <p className="plancard__price">
              <strong>{tier.price}</strong> <span>{tier.unit}</span>
            </p>
            <p className="plancard__desc">{tier.desc}</p>
            <ul className="plancard__benefits">
              {tier.benefits.map((b) => (
                <li key={b}>
                  <IconCheck width={16} height={16} aria-hidden /> {b}
                </li>
              ))}
            </ul>
            <a
              className={`btn ${tier.popular ? 'btn--cta' : 'btn--ghost'} plancard__cta`}
              href={tier.href}
            >
              {tier.cta}
            </a>
          </article>
        ))}
      </div>

      {/* Pro / business subscription */}
      <div className="plans__section-head">
        <h2 className="card__title">{p.pro_title}</h2>
        <p className="account__muted">{p.pro_sub}</p>
      </div>
      <div className="plans__grid plans__grid--two">
        {pro.map((tier) => (
          <article
            key={tier.name}
            className={`plancard ${tier.highlight ? 'plancard--featured' : ''}`}
          >
            <h3 className="plancard__name">{tier.name}</h3>
            <p className="plancard__price">
              <strong>{tier.price}</strong> <span>{tier.unit}</span>
            </p>
            <p className="plancard__desc">{tier.desc}</p>
            <ul className="plancard__benefits">
              {tier.benefits.map((b) => (
                <li key={b}>
                  <IconCheck width={16} height={16} aria-hidden /> {b}
                </li>
              ))}
            </ul>
            <a
              className={`btn ${tier.highlight ? 'btn--cta' : 'btn--ghost'} plancard__cta`}
              href={'href' in tier && tier.href ? tier.href : '/vender/comecar'}
            >
              {tier.cta}
            </a>
          </article>
        ))}
      </div>

      {/* How it works */}
      <div className="plans__how">
        <h2 className="card__title">{p.how_title}</h2>
        <ol className="plans__steps">
          {how.map((step, idx) => (
            <li key={step}>
              <span className="plans__stepno" aria-hidden="true">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
