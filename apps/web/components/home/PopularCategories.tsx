import type { Dictionary } from '../../lib/i18n/index';

// Fiverr-structured "popular categories" card grid (Nhonga brand). Each card is
// a category image (the reliable /ph placeholder as a CSS background) with a
// label, linking to that category. Image-card look, classifieds substance.
const CATS = [
  'viaturas',
  'imoveis',
  'empregos',
  'servicos',
  'eventos',
  'telemoveis',
  'moda',
  'casa',
] as const;

export function PopularCategories({ t }: { t: Dictionary }) {
  return (
    <section className="section" aria-labelledby="popcats">
      <div className="section__head">
        <h2 className="section__title" id="popcats">
          {t.home.popular_cats}
        </h2>
      </div>
      <div className="popcats">
        {CATS.map((slug) => {
          const label = (t.categories as Record<string, string>)[slug] ?? slug;
          const img = `/ph?c=${encodeURIComponent(slug)}&t=${encodeURIComponent(label)}`;
          return (
            <a className="popcat" key={slug} href={`/categoria/${slug}`}>
              <span
                className="popcat__img"
                aria-hidden="true"
                style={{ backgroundImage: `url("${img}")` }}
              />
              <span className="popcat__label">{label}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
