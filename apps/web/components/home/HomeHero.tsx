import { HeroCarousel, type Slide } from '../HeroCarousel';
import { HeroSideCard } from './HeroSideCard';
import { IconChevronLeft } from '../icons';
import type { Dictionary } from '../../lib/i18n/index';

const CATEGORY_KEYS = [
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

// Three-column landing hero (Alibaba-structured, Nhonga's look): a vertical
// category rail, a central hero carousel, and a session-aware account/benefits
// card. Stacks on smaller screens.
export function HomeHero({ t, slides }: { t: Dictionary; slides: Slide[] }) {
  return (
    <div className="homehero">
      <nav className="homehero__cats" aria-label={t.home.cats_title}>
        <h2 className="homehero__cats-title">{t.home.cats_title}</h2>
        <ul>
          {CATEGORY_KEYS.map((k) => (
            <li key={k}>
              <a href={`/categoria/${k}`}>
                <span>{t.categories[k]}</span>
                <IconChevronLeft
                  width={16}
                  height={16}
                  style={{ transform: 'rotate(180deg)' }}
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="homehero__banner">
        <HeroCarousel
          slides={slides}
          prevLabel={t.home.carousel_prev}
          nextLabel={t.home.carousel_next}
          gotoLabel={t.home.carousel_goto}
        />
      </div>

      <HeroSideCard t={t} />
    </div>
  );
}
