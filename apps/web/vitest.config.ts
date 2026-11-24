import { defineConfig } from 'vitest/config';

// Unit tests for the web app's server-side helpers (lib/*). Component and
// end-to-end tests are tracked as TEST-01.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
});
