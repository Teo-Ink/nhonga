'use client';
import { useEffect, useState } from 'react';

// "Poupar dados" — a per-device preference for 3G / capped data. When on, it
// sets data-save-data="on" on <html>; CSS then drops the heaviest decorative
// media (the hero video). Content images are kept — only decoration is cut.
// The pre-hydration script in layout applies the saved value before paint, so
// there is no flash; this control just flips and persists it.
const KEY = 'nhonga:save-data';

export function DataSaverToggle({ label }: { label: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(document.documentElement.dataset.saveData === 'on');
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    document.documentElement.dataset.saveData = next ? 'on' : '';
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className="datasaver"
      role="switch"
      aria-checked={on}
      onClick={toggle}
    >
      <span className="datasaver__track" aria-hidden="true">
        <span className="datasaver__thumb" />
      </span>
      {label}
    </button>
  );
}
