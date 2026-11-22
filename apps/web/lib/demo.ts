// Demo mode: shows "this is a demo" notices and allows the seed's sample
// photos. On in `next dev` by default; off in a production build unless
// NEXT_PUBLIC_DEMO_MODE=1 is set (e.g. for a public demo/staging site).
// next.config.mjs mirrors this rule for the build-time settings.
const flag = process.env.NEXT_PUBLIC_DEMO_MODE;

export const IS_DEMO: boolean =
  flag === '1' || flag === 'true' || (flag === undefined && process.env.NODE_ENV !== 'production');
