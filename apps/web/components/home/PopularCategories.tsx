import type { Dictionary } from '../../lib/i18n/index';
import { Slider } from './Slider';

// Fiverr-structured "popular categories" slider (Nhonga brand): a horizontal
// scroll bar of cards, each a green title band + a real, related photo. Images
// are CC-licensed (Openverse/Flickr), reflecting each category.
const CATS: { slug: string; img: string }[] = [
  { slug: 'viaturas', img: 'https://live.staticflickr.com/8711/16687001674_c0659d5e69_b.jpg' },
  { slug: 'imoveis', img: 'https://live.staticflickr.com/5549/11415902663_24562801da.jpg' },
  { slug: 'empregos', img: 'https://live.staticflickr.com/7351/14090438714_33bec862fe_b.jpg' },
  { slug: 'servicos', img: 'https://live.staticflickr.com/1046/840731747_029504ca41_b.jpg' },
  { slug: 'eventos', img: 'https://live.staticflickr.com/3490/3734360895_9ca52b84a2_b.jpg' },
  { slug: 'telemoveis', img: 'https://live.staticflickr.com/3200/2736563610_d172046032_b.jpg' },
  { slug: 'moda', img: 'https://live.staticflickr.com/4592/27737163279_5d47b0f79f.jpg' },
  { slug: 'casa', img: 'https://live.staticflickr.com/4361/35963279133_2463c3c9ba_b.jpg' },
];

export function PopularCategories({ t }: { t: Dictionary }) {
  return (
    <section className="section" aria-labelledby="popcats">
      <div className="section__head">
        <h2 className="section__title" id="popcats">
          {t.home.popular_cats}
        </h2>
      </div>
      <Slider prevLabel={t.home.carousel_prev} nextLabel={t.home.carousel_next}>
        {CATS.map(({ slug, img }) => {
          const label = (t.categories as Record<string, string>)[slug] ?? slug;
          return (
            <a className="popcard" key={slug} href={`/categoria/${slug}`}>
              <span className="popcard__head">{label}</span>
              <span
                className="popcard__img"
                aria-hidden="true"
                style={{ backgroundImage: `url("${img}")` }}
              />
            </a>
          );
        })}
      </Slider>
    </section>
  );
}
