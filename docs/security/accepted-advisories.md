# Accepted advisories

Every entry here is a deliberate exception to the `pnpm audit --audit-level high`
gate in `.github/workflows/ci.yml`. The gate itself stays at **high** — we do
not lower it to "critical only" to make a single finding go away, because that
would silently accept every future high as well.

Each exception must say what it is, why it cannot be fixed now, why the risk is
acceptable, and what would make us revisit it. Re-review at every dependency
bump.

---

## GHSA-fx2h-pf6j-xcff — vite `server.fs.deny` bypass on Windows alternate paths

|                       |                                                                           |
| --------------------- | ------------------------------------------------------------------------- |
| **Severity**          | High                                                                      |
| **Affected**          | `vite <= 6.4.2`, patched in `>= 6.4.3`                                    |
| **How it reaches us** | `vitest@3.2.7 -> vite@5.4.21` (also via `@vitest/mocker` and `vite-node`) |
| **Accepted on**       | 2026-09-17                                                                |

**Why it is not fixed.** The vulnerable package is a transitive dependency of
Vitest. Vitest 3.2.7 pins Vite 5.x and has not yet moved to a patched 6.4.3+.
Forcing the upgrade with a pnpm override would put Vitest on a Vite major it
does not support, which risks breaking the test runner — the thing that proves
the payments logic is correct.

**Why the risk is acceptable.**

- Vite is a **development and test dependency only**. It is not in
  `dependencies` for any package and will never be installed into the runtime
  container.
- The vulnerability requires an attacker to reach a **running Vite dev server**
  and depends on **Windows** alternate path handling. CI runs on
  `ubuntu-latest`, and no Vite dev server is exposed by any workflow.
- Exploitation reads files the dev server was configured to deny. On a
  developer laptop that is a local-only disclosure risk, not a path into
  production or into customer data.

**What would change this assessment.**

- Vitest releasing a version that depends on Vite `>= 6.4.3` — upgrade and
  delete this entry.
- Any workflow or environment starting to expose a Vite dev server.
- The advisory being revised to affect the build output rather than the dev
  server.

**Removal.** Delete the GHSA from `pnpm.auditConfig.ignoreGhsas` in the root
`package.json` and delete this section.
