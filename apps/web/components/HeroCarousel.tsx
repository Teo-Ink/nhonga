'use client';
import { useEffect, useRef, useState } from 'react';

export interface Slide {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
}

// Rotating jumbotron (Amazon-style hero carousel, Nhonga's look). Auto-advances
// every 6s, pauses on hover/focus, and honours prefers-reduced-motion (no
// auto-advance). Arrows and dots for manual control; slides crossfade.
export function HeroCarousel({
  slides,
  prevLabel,
  nextLabel,
  gotoLabel,
}: {
  slides: Slide[];
  prevLabel: string;
  nextLabel: string;
  gotoLabel: string;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (paused || reduced.current || n <= 1) return;
    const id = setInterval(() => setI((v) => (v + 1) % n), 6000);
    return () => clearInterval(id);
  }, [paused, n]);

  const go = (next: number) => setI(((next % n) + n) % n);

  return (
    <section
      className="hcar"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="hcar__viewport">
        {slides.map((s, idx) => (
          <div
            key={idx}
            className={`hcar__slide hcar__slide--${idx % 3} ${idx === i ? 'is-active' : ''}`}
            aria-hidden={idx !== i}
          >
            <div className="hcar__content">
              <h1 className="hcar__title">{s.title}</h1>
              <p className="hcar__subtitle">{s.subtitle}</p>
              <a className="btn btn--cta hcar__cta" href={s.href} tabIndex={idx === i ? 0 : -1}>
                {s.cta}
              </a>
            </div>
          </div>
        ))}
      </div>

      {n > 1 ? (
        <>
          <button
            type="button"
            className="hcar__arrow hcar__arrow--prev"
            aria-label={prevLabel}
            onClick={() => go(i - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="hcar__arrow hcar__arrow--next"
            aria-label={nextLabel}
            onClick={() => go(i + 1)}
          >
            ›
          </button>
          <div className="hcar__dots" role="tablist">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === i}
                aria-label={gotoLabel.replace('{n}', String(idx + 1))}
                className={`hcar__dot ${idx === i ? 'is-active' : ''}`}
                onClick={() => go(idx)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
