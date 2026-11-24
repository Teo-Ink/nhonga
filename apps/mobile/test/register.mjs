// Test setup for `node --test` (no bundler, no React Native runtime).
// Registers a resolver so the app's own modules can be imported as written:
// extensionless relative imports, the "@/" alias, and a stub for the native
// secure store. Screens are not loaded here; these tests cover the app's
// logic layer (API client, session, money formatting, release guards).
import { register } from 'node:module';

register('./resolve.mjs', import.meta.url);
