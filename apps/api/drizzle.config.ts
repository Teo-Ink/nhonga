import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Generated from compiled output, not from source. drizzle-kit's loader cannot resolve the
  // `.js` specifiers that Node ESM requires of TypeScript sources, and pointing it at dist has
  // the added benefit that migrations are generated from exactly the code that ships.
  // `pnpm db:generate` builds first.
  schema: './dist/db/schema/index.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://nhoga:nhoga@localhost:5432/nhoga',
  },
  // Forward-only, one migration per pull request, reviewed as code.
  // Migrations are the one part of a release that is not reversible, so they get more scrutiny
  // than application code. See docs/phase-2-architecture/06-infrastructure.md §5.
  strict: true,
  verbose: true,
});
