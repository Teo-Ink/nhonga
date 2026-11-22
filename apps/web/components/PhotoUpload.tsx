'use client';
import { useRef, useState } from 'react';
import { IconBox } from './icons';

// Multi-photo picker for a listing. Photos are compressed in the browser
// (max 1600px, JPEG) before they are ever held or sent — the same "modo leve"
// spirit as the rest of the app, so a phone on 3G uploads kilobytes, not
// megabytes. No external storage is needed for the demo: each photo becomes a
// small data URL kept in form state and shown in the preview. The first photo
// is the cover ("principal"); photos can be removed or promoted to cover.
type Labels = {
  add: string;
  hint: string;
  cover: string;
  makeCover: string;
  remove: string;
  count: (n: number, max: number) => string;
};

async function compress(file: File, maxDim = 1600, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoUpload({
  photos,
  onChange,
  labels,
  max = 6,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  labels: Labels;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const room = max - photos.length;
      const picked = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, Math.max(0, room));
      const encoded = await Promise.all(picked.map((f) => compress(f)));
      onChange([...photos, ...encoded]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove(i: number) {
    onChange(photos.filter((_, idx) => idx !== i));
  }
  function makeCover(i: number) {
    if (i === 0) return;
    const next = [...photos];
    const [picked] = next.splice(i, 1);
    next.unshift(picked);
    onChange(next);
  }

  const full = photos.length >= max;

  return (
    <div className="photoup">
      <div className="photoup__grid">
        {photos.map((src, i) => (
          <div className="photoup__item" key={src.slice(0, 32) + i}>
            <img src={src} alt="" className="photoup__img" />
            {i === 0 ? <span className="photoup__cover">{labels.cover}</span> : null}
            <div className="photoup__actions">
              {i !== 0 ? (
                <button
                  type="button"
                  className="photoup__act"
                  onClick={() => makeCover(i)}
                  title={labels.makeCover}
                  aria-label={labels.makeCover}
                >
                  ★
                </button>
              ) : null}
              <button
                type="button"
                className="photoup__act photoup__act--del"
                onClick={() => remove(i)}
                title={labels.remove}
                aria-label={labels.remove}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {!full ? (
          <button
            type="button"
            className="uploadbox photoup__add"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <IconBox />
            <span>{busy ? '…' : labels.add}</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
      <span className="field__hint">
        {labels.count(photos.length, max)} · {labels.hint}
      </span>
    </div>
  );
}
