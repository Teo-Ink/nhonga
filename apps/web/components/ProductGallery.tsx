'use client';
import { useState } from 'react';
import Image from 'next/image';

interface Img {
  url: string;
  alt?: string | null;
}

// Product image gallery: a large main image with a clickable thumbnail strip.
// Click (or keyboard-focus + Enter) a thumb to swap the main image.
export function ProductGallery({ images, title }: { images: Img[]; title: string }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];
  const unopt = (src: string) => src.startsWith('/ph');

  return (
    <div className="pgal">
      <div className="pdp__hero pgal__main">
        {main ? (
          <Image
            src={main.url}
            alt={main.alt ?? title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            unoptimized={unopt(main.url)}
            style={{ objectFit: 'cover' }}
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="pdp__thumbs" role="tablist" aria-label="Fotos do anúncio">
          {images.map((img, i) => (
            <button
              type="button"
              key={i}
              role="tab"
              aria-selected={i === active}
              aria-label={`Foto ${i + 1}`}
              className={`pdp__thumb pgal__thumb ${i === active ? 'is-on' : ''}`}
              onClick={() => setActive(i)}
            >
              <Image
                src={img.url}
                alt={img.alt ?? ''}
                width={56}
                height={56}
                unoptimized={unopt(img.url)}
                style={{ objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
