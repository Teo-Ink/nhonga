import type { Dictionary } from '../../lib/i18n/index';
import { IconSearch, IconChat, IconCheck } from '../icons';

// "How it works" value section (Fiverr-structured value block, classifieds
// substance): search → contact the seller → agree. Contact-first, no escrow.
export function HowItWorks({ t }: { t: Dictionary }) {
  const steps = [
    { Icon: IconSearch, title: t.home.how1_t, body: t.home.how1_b },
    { Icon: IconChat, title: t.home.how2_t, body: t.home.how2_b },
    { Icon: IconCheck, title: t.home.how3_t, body: t.home.how3_b },
  ];
  return (
    <section className="section howworks" aria-labelledby="howworks-title">
      <div className="section__head">
        <h2 className="section__title" id="howworks-title">
          {t.home.how_title}
        </h2>
      </div>
      <ol className="howworks__steps">
        {steps.map((s, i) => (
          <li className="howstep" key={i}>
            <span className="howstep__num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="howstep__icon" aria-hidden="true">
              <s.Icon width={24} height={24} />
            </span>
            <strong className="howstep__title">{s.title}</strong>
            <span className="howstep__body">{s.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
