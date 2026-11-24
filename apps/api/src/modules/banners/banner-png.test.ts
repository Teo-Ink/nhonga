import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANNER_FONT_FILES, rasterizeBanner } from './banner-png.js';

// BAN-01: without fonts resvg draws the shapes but drops the text, so a
// banner with text and the same banner without it rasterise identically.
const svg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100">` +
  `<rect width="400" height="100" fill="#000000"/>` +
  `<text x="10" y="60" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="800" fill="#ffffff">${label}</text>` +
  `</svg>`;

describe('banner PNG rasteriser (BAN-01)', () => {
  it('ships its own fonts', () => {
    for (const f of BANNER_FONT_FILES) expect(existsSync(f), f).toBe(true);
  });

  it('draws text without relying on system fonts', async () => {
    const withText = await rasterizeBanner(svg('Toyota RunX 2005'), 400);
    const empty = await rasterizeBanner(svg(''), 400);
    expect(withText.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(withText.equals(empty)).toBe(false);
  });
});
