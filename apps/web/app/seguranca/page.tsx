import type { Metadata } from 'next';
import { IconShield, IconCheck, IconMapPin } from '../../components/icons';
import { getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: `${t.safety.title} — ${t.common.brand}`, description: t.safety.subtitle };
}

// Safety centre (B): honest guidance for a classifieds model with no escrow —
// meet in public, check before paying, never share credentials, how to report.
export default async function SafetyPage() {
  const { t } = await getDictionary();
  const s = t.safety;

  return (
    <section className="section spotpage" aria-labelledby="safety-title">
      <span className="invite__badge" aria-hidden="true" style={{ marginTop: 0 }}>
        <IconShield width={36} height={36} />
      </span>
      <h1 className="section__title" id="safety-title">
        {s.title}
      </h1>
      <p className="spotpage__lead">{s.subtitle}</p>

      <div className="safetygrid">
        <div className="safetycard">
          <h2 className="safetycard__title">
            <IconMapPin width={18} height={18} /> {s.buyers_title}
          </h2>
          <ul className="safetylist">
            <li>{s.b1}</li>
            <li>{s.b2}</li>
            <li>{s.b3}</li>
            <li>{s.b4}</li>
          </ul>
        </div>
        <div className="safetycard">
          <h2 className="safetycard__title">
            <IconCheck width={18} height={18} /> {s.sellers_title}
          </h2>
          <ul className="safetylist">
            <li>{s.s1}</li>
            <li>{s.s2}</li>
            <li>{s.s3}</li>
          </ul>
        </div>
      </div>

      <div className="safetywarn">
        <strong>{s.never_title}</strong>
        <p>{s.never_body}</p>
      </div>

      <div className="spotboost">
        <div>
          <strong>{s.report_title}</strong>
          <p>{s.report_body}</p>
        </div>
        <a className="btn btn--ghost" href="/ajuda">
          {s.report_cta}
        </a>
      </div>
    </section>
  );
}
