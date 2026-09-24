import { IconApple, IconGooglePlay, IconCheck } from '../icons';
import type { Dictionary } from '../../lib/i18n/index';

// App-download promo for the landing page. The iOS/Android apps do NOT exist
// yet, so the store badges are honestly marked "Em breve" (coming soon) and are
// non-interactive — no fake download links. Swap in real store URLs (and make
// them <a>) once the apps are published.
export function AppPromo({ t }: { t: Dictionary }) {
  const h = t.home;
  const benefits = [h.app_b1, h.app_b2, h.app_b3];

  return (
    <section className="appromo" aria-labelledby="appromo-title">
      <div className="appromo__text">
        <h2 className="appromo__title" id="appromo-title">
          {h.app_title}
        </h2>
        <p className="appromo__sub">{h.app_sub}</p>

        <ul className="appromo__benefits">
          {benefits.map((b) => (
            <li key={b}>
              <IconCheck width={18} height={18} aria-hidden /> {b}
            </li>
          ))}
        </ul>

        <div className="appromo__badges">
          <span className="storebadge" role="group" aria-label={`App Store — ${h.app_soon}`}>
            <IconApple width={24} height={24} />
            <span className="storebadge__text">
              <small>{h.app_ios_small}</small>
              <strong>App Store</strong>
            </span>
            <span className="storebadge__soon">{h.app_soon}</span>
          </span>
          <span className="storebadge" role="group" aria-label={`Google Play — ${h.app_soon}`}>
            <IconGooglePlay width={22} height={22} />
            <span className="storebadge__text">
              <small>{h.app_and_small}</small>
              <strong>Google Play</strong>
            </span>
            <span className="storebadge__soon">{h.app_soon}</span>
          </span>
        </div>

        <p className="appromo__note" role="note">
          {h.app_note}
        </p>
      </div>

      {/* Decorative phone mockup showing the brand. */}
      <div className="appromo__art" aria-hidden="true">
        <div className="phone">
          <span className="phone__notch" />
          <div className="phone__screen">
            <img className="phone__logo" src="/brand/logo-branco.svg" alt="" />
            <span className="phone__tag">{h.app_screen_tag}</span>
            <span className="phone__mark" />
          </div>
        </div>
      </div>
    </section>
  );
}
