// Top-level navigation grouping (Gumtree-style pillars).
//
// The classifieds verticals are standalone pillars; the everyday-goods
// categories live under a single "Compra e Vendas" (For Sale) section, reachable
// at /compra-e-vendas. Per the product owner's list, Imóveis sits inside this
// section (Gumtree keeps Property separate — easy to move out if wanted).

export const FORSALE_KEYS = [
  'imoveis',
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

export type ForSaleKey = (typeof FORSALE_KEYS)[number];

// Standalone pillars (each links straight to its category page).
export const PILLAR_KEYS = ['viaturas', 'servicos', 'empregos', 'eventos'] as const;

export type PillarKey = (typeof PILLAR_KEYS)[number];
