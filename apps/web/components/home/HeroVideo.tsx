'use client';
import { useRef, useState } from 'react';

// Animated jumbotron background: a muted, looping, autoplaying video (a busy
// local market) behind the hero, with a brand scrim for legibility and a
// play/pause control. The hero's green gradient shows first / if the video
// fails, so this degrades gracefully; the video is hidden on phones by CSS to
// spare mobile data (Mozambique / 3G).
export function HeroVideo({
  src,
  pauseLabel,
  playLabel,
}: {
  src: string;
  pauseLabel: string;
  playLabel: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

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
        preload="auto"
        aria-hidden="true"
      >
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
