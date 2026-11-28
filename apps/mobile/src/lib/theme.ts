// Nhonga brand palette (matches the web design tokens).
export const brand = {
  green: '#007A5E',
  greenDark: '#0b5138',
  greenDeep: '#083b28',
  yellow: '#F2B705',
  ink: '#171717',
  white: '#ffffff',
  bg: '#ffffff',
  surface: '#f6f6f5',
  surfaceSunken: '#efefee',
  border: '#e4e4e3',
  text: '#1a1a1a',
  muted: '#6b7280',
  danger: '#c0362c',
} as const;

// Corners (UX-12): one small radius for buttons, fields, cards and tags, like
// the classifieds sites people already know. `pill` is only for things that
// are meant to be round: avatars and dots.
export const radius = { sm: 4, md: 4, lg: 4, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// Soft, layered elevation that reads as real depth. Uses the modern cross-platform
// `boxShadow` style (RN 0.76+ New Architecture) — the legacy shadow*/elevation
// props are deprecated. Mirrors the web's warm-tinted shadow tokens.
export const shadow = {
  sm: { boxShadow: '0px 1px 3px rgba(43, 38, 32, 0.08)' },
  md: { boxShadow: '0px 2px 4px rgba(43, 38, 32, 0.06), 0px 10px 20px rgba(43, 38, 32, 0.12)' },
} as const;

// Shared type ramp so screens stay consistent.
export const font = {
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  price: { fontSize: 15, fontWeight: '800' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '500' as const },
};
