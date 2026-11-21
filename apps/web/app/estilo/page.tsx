import { Price, Rating, DealBadge, VerifiedBadge, Skeleton, EmptyState } from '../../components/ui';
import { IconBox, IconShield } from '../../components/icons';
import { getDictionary } from '../../lib/i18n/index';
import { RAMPS, SEMANTIC, type Swatch } from '../../lib/palette';

export const dynamic = 'force-dynamic';

// Design-system showcase — the visual handoff reference. Swatches are painted
// with the real CSS variables (never a copied hex), so this page can never
// drift from tokens.css. Fixed colour scales list their hex; semantic roles do
// not, because they intentionally change between light and dark.
// Ramps and semantic roles come from lib/palette.ts (generated with tokens.css).
const TYPE_SCALE = [
  { token: '--text-3xl', label: '32 / 3xl' },
  { token: '--text-2xl', label: '24 / 2xl' },
  { token: '--text-xl', label: '20 / xl' },
  { token: '--text-lg', label: '18 / lg' },
  { token: '--text-base', label: '16 / base' },
  { token: '--text-sm', label: '14 / sm' },
  { token: '--text-xs', label: '12 / xs' },
];

function SwatchRow({ items, showHex }: { items: Swatch[]; showHex?: boolean }) {
  return (
    <div className="swatchrow">
      {items.map((s) => (
        <div className="swatch" key={s.token}>
          <span className="swatch__chip" style={{ background: `var(${s.token})` }} />
          <span className="swatch__token">{s.token.replace('--', '')}</span>
          {showHex && s.hex ? <span className="swatch__hex">{s.hex}</span> : null}
        </div>
      ))}
    </div>
  );
}

export default async function StyleGuidePage() {
  const { t } = await getDictionary();
  const s = t.style;

  return (
    <section className="ds">
      <header className="ds__head">
        <h1 className="section__title">{s.title}</h1>
        <p className="ds__subtitle">{s.subtitle}</p>
        <p className="ds__note">
          <IconShield width={16} height={16} /> {s.contrast_note}
        </p>
      </header>

      {/* Colours */}
      <h2 className="ds__h2">{s.colors}</h2>
      <div className="ds__block">
        {RAMPS.map((r) => (
          <div key={r.name}>
            <h3 className="ds__h3">{r.name}</h3>
            <SwatchRow items={r.swatches} showHex />
          </div>
        ))}
        <h3 className="ds__h3">{s.semantic}</h3>
        <SwatchRow items={SEMANTIC} />
      </div>

      {/* Typography */}
      <h2 className="ds__h2">{s.typography}</h2>
      <div className="ds__block">
        {TYPE_SCALE.map((ts) => (
          <div className="typerow" key={ts.token}>
            <span className="typerow__label">{ts.label}</span>
            <span style={{ fontSize: `var(${ts.token})`, fontWeight: 600 }}>
              Compre e venda em Moçambique
            </span>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <h2 className="ds__h2">{s.buttons}</h2>
      <div className="ds__block ds__row">
        <button className="btn btn--cta" style={{ maxWidth: 200 }}>
          {t.pdp.add_to_cart}
        </button>
        <button className="btn btn--primary" style={{ maxWidth: 200 }}>
          {t.cart.checkout}
        </button>
        <button className="btn btn--ghost" style={{ maxWidth: 200 }}>
          {t.common.see_all}
        </button>
      </div>

      {/* Badges */}
      <h2 className="ds__h2">{s.badges}</h2>
      <div className="ds__block ds__row">
        <DealBadge percent={25} />
        <VerifiedBadge label={t.common.verified} />
        <span className="badge badge--soldout">{t.common.sold_out}</span>
        <Rating value={4.8} count={41} />
      </div>

      {/* Forms */}
      <h2 className="ds__h2">{s.forms}</h2>
      <div className="ds__block" style={{ maxWidth: 420 }}>
        <label className="field">
          <span className="field__label">{s.sample_input}</span>
          <input className="field__input" placeholder="Placeholder" />
        </label>
        <label className="field">
          <span className="field__label">{t.checkout.province_label}</span>
          <select className="field__input" defaultValue="">
            <option value="">{t.checkout.province_ph}</option>
            <option>Maputo Cidade</option>
          </select>
        </label>
      </div>

      {/* Product card + price */}
      <h2 className="ds__h2">{s.cards}</h2>
      <div className="ds__block ds__row">
        <div className="card" style={{ maxWidth: 200 }}>
          <div className="card__media">
            <DealBadge percent={25} />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <IconBox />
            </span>
          </div>
          <div className="card__body">
            <span className="card__title">{s.cards}</span>
            <Price now={45000} was={60000} />
            <span className="card__vendor">
              <Rating value={4.8} />
            </span>
          </div>
        </div>
      </div>

      {/* States */}
      <h2 className="ds__h2">{s.states}</h2>
      <div className="ds__block">
        <h3 className="ds__h3">{s.state_skeleton}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
          <Skeleton w="70%" h={16} />
          <Skeleton w="40%" h={16} />
          <Skeleton w="90%" h={16} />
        </div>
        <h3 className="ds__h3">{s.state_empty}</h3>
        <EmptyState icon={<IconBox />}>{t.search.no_results_body}</EmptyState>
      </div>
    </section>
  );
}
