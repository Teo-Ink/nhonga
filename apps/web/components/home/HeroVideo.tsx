'use client';
import { useEffect, useRef, useState } from 'react';

// Animated jumbotron background: a muted, looping video (a busy local market)
// behind the hero, with a brand scrim for legibility and a play/pause control.
//
// Mobile data is expensive in Mozambique (PERF-01), so the video is only
// mounted when all of these hold: a desktop-width screen, no Data Saver (the
// browser's or Nhonga's own), a 4G-or-better connection where the browser
// reports it, and no request for reduced motion. Otherwise nothing is
// downloaded and the hero keeps its still photo and gradient.
const MIN_WIDTH_PX = 900;

function canPlayHeroVideo(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia(`(min-width: ${MIN_WIDTH_PX}px)`).matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (document.documentElement.getAttribute('data-save-data') === 'on') return false;
  const conn = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && conn.effectiveType !== '4g') return false;
  return true;
}

export function HeroVideo({
  src,
  webmSrc,
  poster,
  pauseLabel,
  playLabel,
}: {
  src: string;
  webmSrc?: string;
  poster: string;
  pauseLabel: string;
  playLabel: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setEnabled(canPlayHeroVideo());
  }, []);

  if (!enabled) return <span className="herofind__scrim" aria-hidden="true" />;

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <video
        ref={ref}
        className="herofind__video"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        aria-hidden="true"
      >
        {webmSrc ? <source src={webmSrc} type="video/webm" /> : null}
        <source src={src} type="video/mp4" />
      </video>
      <span className="herofind__scrim" aria-hidden="true" />
      <button
        type="button"
        className="herofind__playpause"
        onClick={toggle}
        aria-label={playing ? pauseLabel : playLabel}
      >
        {playing ? '❚❚' : '►'}
      </button>
    </>
  );
}
