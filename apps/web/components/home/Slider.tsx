'use client';
import { useRef, type ReactNode } from 'react';

// Horizontal slider bar (Fiverr-structured): a scroll-snap track with ‹ › arrows
// that page by ~80% of the visible width. Native scroll/swipe works too, so it
// is fine without JS; the arrows are a progressive enhancement.
export function Slider({
  children,
  prevLabel,
  nextLabel,
}: {
  children: ReactNode;
  prevLabel: string;
  nextLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const page = (dir: 1 | -1): void => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  };
  return (
    <div className="slider">
      <button
        type="button"
        className="slider__arrow slider__arrow--prev"
        onClick={() => page(-1)}
        aria-label={prevLabel}
      >
        ‹
      </button>
      <div className="slider__track" ref={ref}>
        {children}
      </div>
      <button
        type="button"
        className="slider__arrow slider__arrow--next"
        onClick={() => page(1)}
        aria-label={nextLabel}
      >
        ›
      </button>
    </div>
  );
}
