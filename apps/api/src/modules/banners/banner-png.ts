import { fileURLToPath } from 'node:url';

// Rasterises a banner SVG to PNG with resvg (BAN-01).
//
// The API image (node:*-slim) has no system fonts, so resvg drew every shape
// but no text: banners came out as photos with empty yellow pills. The fonts
// now travel with the app (assets/fonts, Liberation Sans, SIL OFL 1.1) and
// system fonts are not loaded, so the PNG is the same on every machine.
// "Arial, Helvetica, sans-serif" in the SVG resolves to Liberation Sans,
// which has Arial's metrics, so the layout computed for Arial still fits.

// src/modules/banners → apps/api/assets; dist/modules/banners → /app/assets.
const FONT_DIR = fileURLToPath(new URL('../../../assets/fonts/', import.meta.url));

export const BANNER_FONT_FILES = [
  `${FONT_DIR}LiberationSans-Regular.ttf`,
  `${FONT_DIR}LiberationSans-Bold.ttf`,
];

export async function rasterizeBanner(svg: string, width = 1200): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js');
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      loadSystemFonts: false,
      fontFiles: BANNER_FONT_FILES,
      defaultFontFamily: 'Liberation Sans',
      sansSerifFamily: 'Liberation Sans',
    },
  })
    .render()
    .asPng();
  return Buffer.from(png);
}
