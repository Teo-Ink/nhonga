import type { BannerSpec } from '../../db/schema/banners.js';

// Deterministic banner compositor. Turns an art-direction spec (copy + palette,
// written by Claude) plus the listing's own photo into a self-contained SVG.
//
// The SVG is self-contained on purpose: when a browser renders SVG through an
// <img> tag it uses "secure static mode", which blocks external images and
// fonts. So the product photo is embedded as a data URI by the caller, and we
// only use web-safe fonts. That makes one asset that renders identically inline,
// as an <img>, and when served directly. The location pin is a vector path,
// not an emoji: the PNG rasteriser has no emoji font (BAN-01).

export type BannerRatio = 'square' | 'landscape' | 'portrait';
export type BannerPreset = 'moderno' | 'minimal' | 'promocao' | 'luxo' | 'alegre' | 'mercado';

export const RATIOS: Record<BannerRatio, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  landscape: { w: 1200, h: 630 },
  portrait: { w: 1080, h: 1920 },
};

export const PRESETS: readonly BannerPreset[] = [
  'moderno',
  'minimal',
  'promocao',
  'luxo',
  'alegre',
  'mercado',
];

// Default palettes per preset. Claude may override bg/accent/text in the spec;
// these are the fallbacks and the identity of each style.
export const PRESET_PALETTE: Record<BannerPreset, { bg: string; accent: string; text: string }> = {
  moderno: { bg: '#0f1a14', accent: '#16a34a', text: '#ffffff' },
  minimal: { bg: '#f5f5f4', accent: '#111827', text: '#111827' },
  promocao: { bg: '#111111', accent: '#f5c518', text: '#ffffff' },
  luxo: { bg: '#10100e', accent: '#c9a227', text: '#f7f3e8' },
  alegre: { bg: '#1d4ed8', accent: '#f97316', text: '#ffffff' },
  mercado: { bg: '#064e3b', accent: '#f5c518', text: '#ffffff' },
};

export interface RenderInput {
  spec: BannerSpec;
  preset: BannerPreset;
  ratio: BannerRatio;
  /** Full product photo as a data URI, or null to use a palette gradient. */
  photoDataUri: string | null;
  /** Exact, pre-formatted price (e.g. "8.950,00 MT"). Never recomputed here. */
  priceLabel: string;
  categoryLabel: string;
  location: string;
  watermarked: boolean;
}

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** A readable hex: fall back to the default if the model returns junk. */
const hex = (v: string | undefined, fallback: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;

/** Trim overlong copy so it never overflows the art. */
const clamp = (s: string, n: number): string => {
  const t = (s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

export function renderBanner(input: RenderInput): string {
  const { ratio, preset, photoDataUri, watermarked } = input;
  const { w, h } = RATIOS[ratio];
  const pal = PRESET_PALETTE[preset];
  const bg = hex(input.spec.bg, pal.bg);
  const accent = hex(input.spec.accent, pal.accent);
  const text = hex(input.spec.text, pal.text);
  const onAccent = readableOn(accent);

  const headline = clamp(input.spec.headline || '', ratio === 'landscape' ? 30 : 26);
  const sub = clamp(input.spec.subheadline || '', 52);
  const cta = clamp(input.spec.cta || 'Contacta já', 22);
  const price = clamp(input.priceLabel, 18);
  const category = clamp(input.categoryLabel, 22);
  const location = clamp(input.location, 28);

  // Scale type to the canvas. Landscape is shorter, so base on the smaller side.
  const unit = Math.min(w, h) / 1080;
  const pad = Math.round(64 * unit);
  const headSize = Math.round((ratio === 'landscape' ? 76 : 92) * unit);
  const subSize = Math.round(38 * unit);
  const priceSize = Math.round(54 * unit);
  const chipSize = Math.round(30 * unit);

  // Photo fills the frame; a scrim keeps text legible over any photo. With no
  // photo we lean on a brand gradient instead.
  const background = photoDataUri
    ? `<image href="${photoDataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
       <rect x="0" y="0" width="${w}" height="${h}" fill="url(#scrim)"/>`
    : `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#grad)"/>`;

  // Bottom content band baseline.
  const bandTop = h - Math.round((ratio === 'landscape' ? 300 : 460) * unit);
  const cornerR = preset === 'minimal' ? 6 : preset === 'luxo' ? 2 : 18;

  // "Promoção" gets a corner sale ribbon.
  const ribbon =
    preset === 'promocao'
      ? `<g transform="translate(${w - 230 * unit},${70 * unit}) rotate(0)">
           <rect x="0" y="0" width="${200 * unit}" height="${64 * unit}" rx="${cornerR}" fill="${accent}"/>
           <text x="${100 * unit}" y="${43 * unit}" font-family="Arial, Helvetica, sans-serif" font-size="${chipSize}" font-weight="800" fill="${onAccent}" text-anchor="middle" letter-spacing="2">PROMOÇÃO</text>
         </g>`
      : '';

  const watermark = watermarked
    ? `<text x="${w - pad}" y="${h - pad / 2}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(24 * unit)}" fill="${text}" fill-opacity="0.55" text-anchor="end">Nhonga · nhonga.co.mz</text>`
    : `<text x="${w - pad}" y="${h - pad / 2}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(24 * unit)}" font-weight="700" fill="${text}" fill-opacity="0.9" text-anchor="end">Nhonga</text>`;

  // Price pill width grows with the text.
  const pillW = Math.round((120 + price.length * 26) * unit);
  const pillH = Math.round(84 * unit);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(headline || category)}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.05"/>
      <stop offset="0.55" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
  </defs>

  ${background}
  ${ribbon}

  <!-- brand + category chip, top-left -->
  <g transform="translate(${pad},${pad})">
    <rect x="0" y="0" width="${Math.round((category.length * 17 + 56) * unit)}" height="${Math.round(56 * unit)}" rx="${cornerR}" fill="${accent}"/>
    <text x="${Math.round(28 * unit)}" y="${Math.round(38 * unit)}" font-family="Arial, Helvetica, sans-serif" font-size="${chipSize}" font-weight="700" fill="${onAccent}">${esc(category)}</text>
  </g>

  <!-- headline block, bottom -->
  <g transform="translate(${pad},${bandTop})">
    <text x="0" y="0" font-family="Arial, Helvetica, sans-serif" font-size="${headSize}" font-weight="800" fill="${text}">${esc(headline)}</text>
    ${sub ? `<text x="0" y="${Math.round(headSize * 0.9)}" font-family="Arial, Helvetica, sans-serif" font-size="${subSize}" fill="${text}" fill-opacity="0.92">${esc(sub)}</text>` : ''}

    <!-- price pill + CTA -->
    <g transform="translate(0,${Math.round(headSize * 1.25 + (sub ? subSize : 0))})">
      <rect x="0" y="0" width="${pillW}" height="${pillH}" rx="${cornerR}" fill="${accent}"/>
      <text x="${pillW / 2}" y="${pillH * 0.66}" font-family="Arial, Helvetica, sans-serif" font-size="${priceSize}" font-weight="800" fill="${onAccent}" text-anchor="middle">${esc(price)}</text>
      <text x="${pillW + Math.round(32 * unit)}" y="${pillH * 0.64}" font-family="Arial, Helvetica, sans-serif" font-size="${subSize}" font-weight="700" fill="${text}">${esc(cta)} →</text>
    </g>
  </g>

  ${
    location
      ? `<g class="location" fill="${text}" fill-opacity="0.8">
    <path transform="translate(${pad},${Math.round(h - pad / 2 - 24 * unit)}) scale(${unit})" d="M10 0C4.5 0 0 4.4 0 9.8 0 17 10 28 10 28S20 17 20 9.8C20 4.4 15.5 0 10 0Zm0 13.5a3.7 3.7 0 1 1 0-7.4 3.7 3.7 0 0 1 0 7.4Z"/>
    <text x="${pad + Math.round(30 * unit)}" y="${h - pad / 2}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(26 * unit)}">${esc(location)}</text>
  </g>`
      : ''
  }
  ${watermark}
</svg>`;
}

/** Pick black or white text for a solid accent, by luminance. */
function readableOn(hexColor: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hexColor);
  if (!m) return '#ffffff';
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}
