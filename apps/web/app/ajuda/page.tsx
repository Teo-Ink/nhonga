import { DisputeForm } from '../../components/DisputeForm';
import { getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

// Help & support. The FAQ is genuine informational content about how the
// marketplace works (not fabricated data). The dispute form is a labelled demo.
export default async function HelpPage() {
  const { t } = await getDictionary();
  const h = t.help;

  const faqs = [
    { q: h.q_payment, a: h.a_payment },
    { q: h.q_delivery, a: h.a_delivery },
    { q: h.q_protection, a: h.a_protection },
    { q: h.q_returns, a: h.a_returns },
    { q: h.q_sell, a: h.a_sell },
    { q: h.q_privacy, a: h.a_privacy },
  ];

  return (
    <section className="help">
      <h1 className="section__title">{h.title}</h1>
      <p className="account__muted">{h.subtitle}</p>
      <p className="demo-banner" role="note" style={{ marginTop: 'var(--space-3)' }}>
        {h.demo_note}
      </p>

      <div className="help__grid">
        <div>
          <h2 className="card__title" style={{ marginBottom: 'var(--space-3)' }}>
            {h.faq_title}
          </h2>
          <div className="faq">
            {faqs.map((f) => (
              <details className="faq__item" key={f.q}>
                <summary className="faq__q">{f.q}</summary>
                <p className="faq__a">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        <DisputeForm t={h} />
      </div>
    </section>
  );
}
