// Stylesheets imported for their side effects (global.css via NativeWind/web).
// expo-env.d.ts normally declares this, but it is generated and git-ignored, so
// a clean checkout (CI) would not type-check without it.
declare module '*.css';
