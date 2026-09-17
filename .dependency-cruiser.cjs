/**
 * Architectural boundaries, enforced in CI.
 *
 * The rule that matters: @nhonga/shared holds money, pricing and state-machine
 * logic used by the API, web and mobile. If it ever imports from an app, the
 * same logic can no longer run in all three places, and the guarantee that a
 * total computed on the phone matches the one computed at settlement is gone.
 */
const CONFIG_FILES = '.config.(ts|js|cjs|mjs)$';
const TEST_FILES = '.test.ts$';

module.exports = {
  forbidden: [
    {
      name: 'shared-must-not-depend-on-apps',
      severity: 'error',
      comment:
        'packages/shared is consumed by api, web and mobile. It must depend on none of them.',
      from: { path: '^packages/shared' },
      to: { path: '^apps' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports break module init order and hide real coupling.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Unreachable module - dead code or a missing wire-up.',
      from: {
        orphan: true,
        // Barrels, type declarations and tool configs are legitimately
        // unreferenced by application code.
        pathNot: ['.d.ts$', '(^|/)index.ts$', CONFIG_FILES],
      },
      to: {},
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      comment:
        'Production code importing a devDependency fails at runtime in the container. Tests and build-time configs (drizzle.config.ts, vitest.config.ts) are exempt - they never ship.',
      from: { path: '^(apps|packages)', pathNot: [TEST_FILES, CONFIG_FILES] },
      // type-only imports (import type ...) are erased by the compiler and never
      // exist in the runtime bundle, so importing @types/* as types is fine.
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(dist|.turbo|drizzle/)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] },
  },
};
