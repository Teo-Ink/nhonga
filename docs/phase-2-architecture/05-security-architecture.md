# 05 · Security Architecture

Phase 2 · Architecture | Status: awaiting sign-off

Mapped against OWASP Top 10 (2021) and OWASP Mobile Top 10 (2024), with the controls that are
specific to _this_ system called out rather than the generic ones.

---

## 1. Threat model — what actually threatens this product

Generic threat modelling produces generic controls. The four threats that matter here:

| Threat                        | Why it's material                                                                                                                                                                                | Primary control                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **OTP abuse**                 | Every SMS costs money. An unprotected OTP endpoint is simultaneously an account-takeover vector and a direct financial drain — an attacker can burn the SMS budget without compromising anything | Multi-axis rate limiting, spend cap, circuit breaker (§3)                |
| **Payment callback forgery**  | A forged "paid" callback creates a free order. This is the highest-value attack on the system                                                                                                    | Signature verification + amount verification + idempotency (payments §4) |
| **Vendor payout redirection** | Compromise a vendor account, change the payout MSISDN, wait for settlement. The money is gone and irreversible                                                                                   | OTP + 24h cooling-off + KYC name match + admin approval                  |
| **Review and listing fraud**  | Destroys the trust the entire marketplace depends on — a slower kill than theft but a more complete one                                                                                          | Reviews bound to delivered order items; moderation queue                 |

Note what is _not_ at the top: card data. There is none. Designing the system so no code path can
accept a payment credential is the strongest possible control over payment credential leakage.

## 2. OWASP Top 10 coverage

| #                             | Risk                                                                                                                                                                                                                                                                               | Controls |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A01 Broken access control     | RBAC enforced in a NestJS guard on every route; ownership checks at the service layer, never only in the controller; vendor scoping applied at the repository layer so a missing check fails closed; admin routes IP-restricted; no IDOR — every resource fetch is scoped by owner |
| A02 Cryptographic failures    | TLS 1.3 only, HSTS preload; AES-256-GCM column encryption via KMS for PII; Argon2id for OTP hashes; SHA-256 for refresh tokens; RDS and S3 encrypted at rest                                                                                                                       |
| A03 Injection                 | Drizzle parameterised queries exclusively — raw SQL requires an explicit reviewed escape hatch; Zod validation at every boundary; React escapes by default; CSP without `unsafe-inline`                                                                                            |
| A04 Insecure design           | Explicit state machines for orders and payments; idempotency on all money paths; DB-level `CHECK` constraints encoding business invariants (`stock_quantity >= 0`, `totals_balance`) so application bugs cannot violate them                                                       |
| A05 Security misconfiguration | Terraform-only infrastructure — no console changes; `tfsec` and `checkov` in CI; least-privilege IAM per task role; no default credentials anywhere                                                                                                                                |
| A06 Vulnerable components     | Dependabot daily; `npm audit` blocking on high/critical in CI; Trivy image scanning; renovate for batched minor updates                                                                                                                                                            |
| A07 Auth failures             | Short-lived access tokens (15 min); rotating refresh tokens with family reuse detection; progressive lockout; no password to leak or reuse (D-04)                                                                                                                                  |
| A08 Integrity failures        | Signed container images; pinned dependency versions with lockfile; SRI on any external asset; provider callbacks signature-verified                                                                                                                                                |
| A09 Logging failures          | Structured logs with correlation IDs; immutable audit log for financial and admin actions; business-level alarms; financial logs never sampled                                                                                                                                     |
| A10 SSRF                      | No user-supplied URL is ever fetched server-side. Vendor image uploads go to S3 via presigned PUT — we never fetch a URL a vendor gives us                                                                                                                                         |

## 3. OTP: the control surface that matters most

Because it is the front door, the cost centre, and the abuse target simultaneously:

```
Layer 1  WAF              — IP reputation, geo anomaly, bot signals
Layer 2  Per phone        — 3 requests / 15 min, escalating cooldown
Layer 3  Per IP           — 10 requests / hour
Layer 4  Per device       — device attestation where available
Layer 5  Global           — circuit breaker on platform-wide send rate
Layer 6  Budget           — hard daily SMS spend cap; refuse sends beyond it
Layer 7  Verification     — 5 attempts per challenge, then the challenge dies
Layer 8  Anomaly          — alert on sudden distribution shifts by prefix or region
```

Additional properties:

- Codes are **6 digits, single-use, 5-minute TTL**, hashed with Argon2id. The plaintext exists only
  in the SMS payload and in memory for the duration of the send.
- Verification timing is **constant** regardless of whether the challenge exists, so failures cannot
  be distinguished.
- Request responses **never reveal whether an account exists**. Enumerating our user base from the
  login endpoint is free reconnaissance we do not need to give away.
- **Fails closed when Redis is down.** An unprotected OTP endpoint is worse than an unavailable one.

## 4. Session and token handling

| Property        | Value                                                          | Reason                                             |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Access token    | JWT, 15 min, RS256                                             | Short enough that theft has a small window         |
| Refresh token   | Opaque random, 30 days, rotating                               | Opaque means no claims to tamper with              |
| Reuse detection | Presenting a rotated token revokes the whole family            | The only reason to present an old token is theft   |
| Web storage     | `httpOnly`, `Secure`, `SameSite=Strict` cookie                 | Not reachable from JS, so XSS cannot exfiltrate it |
| Mobile storage  | iOS Keychain / Android Keystore via `react-native-keychain`    | Never AsyncStorage, never MMKV                     |
| Revocation      | Immediate on logout, password-equivalent change, or suspension |                                                    |

JWTs carry `sub`, `roles`, `vendorId`, `jti`, and nothing else. No PII in a token that sits in a
client and gets logged by intermediaries.

## 5. OWASP Mobile Top 10

| #                                 | Risk                                                                                                                                                                     | Control |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| M1 Credential misuse              | No stored passwords; tokens in Keychain/Keystore                                                                                                                         |
| M2 Inadequate supply chain        | Pinned deps, signed builds, EAS build provenance                                                                                                                         |
| M3 Insecure auth/authz            | Server-authoritative everywhere; the client never decides a permission or a payment state                                                                                |
| M4 Insufficient I/O validation    | Zod schemas shared with the server via `packages/shared` — identical rules, not parallel ones                                                                            |
| M5 Insecure communication         | TLS 1.3; **certificate pinning on payment and auth endpoints only** — pinning everything creates an outage risk when certificates rotate, for no gain on catalogue reads |
| M6 Inadequate privacy             | Minimal permissions, each requested in context with an explanation; GPS strictly opt-in (D-10)                                                                           |
| M7 Insufficient binary protection | ProGuard/R8, Hermes bytecode, no secrets in the bundle — anything in the app binary is public                                                                            |
| M8 Security misconfiguration      | No debug builds shipped; `usesCleartextTraffic=false`; no exported components                                                                                            |
| M9 Insecure data storage          | MMKV holds only cache and queue data. No PII, no tokens. The offline queue holds idempotency keys and item references, never payment details                             |
| M10 Insufficient cryptography     | Platform crypto only; no hand-rolled anything                                                                                                                            |

## 6. Secrets management

| Secret                       | Storage                       | Rotation                                             |
| ---------------------------- | ----------------------------- | ---------------------------------------------------- |
| DB credentials               | Secrets Manager, auto-rotated | 30 days                                              |
| Payment provider credentials | Secrets Manager, manual       | On provider request                                  |
| JWT signing keys             | Secrets Manager, versioned    | 90 days, with overlap so in-flight tokens stay valid |
| KMS data keys                | KMS, automatic                | Annual                                               |
| Third-party API keys         | Secrets Manager               | Quarterly                                            |

Enforcement, so this is a property of the repo and not a policy people remember:

- `gitleaks` runs in CI **and** as a pre-commit hook.
- No `.env` file is ever committed; `.env.example` carries names and empty values only.
- ECS tasks receive secrets as injected task-definition secrets, never as plaintext env vars in the
  definition.
- CI has no long-lived AWS keys — GitHub Actions authenticates via OIDC to a scoped role.

## 7. Audit logging

Every one of these writes an immutable `audit_log` row with actor, timestamp, before/after, reason,
and IP:

- Vendor approval, rejection, suspension
- Commission or fee configuration change
- Settlement approval and release
- Manual refund or order state override
- Payout account change
- Role or permission change
- Product removal by moderation
- Any admin read of KYC documents _(reading someone's identity documents is itself an auditable act)_

The table is append-only by trigger, not by convention. Retention seven years.

## 8. Input validation and file uploads

- **Zod at every boundary**, with the schema shared between client and server so validation cannot
  diverge — the client's rules are the server's rules, imported from the same file.
- Uploads go **direct to S3 via presigned PUT**, never through the API. Content-type allowlist
  (`image/jpeg`, `image/png`, `image/webp`, `image/avif`), 10MB cap, magic-byte verification in a
  post-processing Lambda that rejects anything whose bytes disagree with its declared type.
- Images are re-encoded server-side, which strips EXIF — including GPS coordinates a vendor did not
  realise their phone embedded in a product photo.
- KYC documents land in a separate bucket with SSE-KMS, no public access, and access logging.
  Reading one is audited (§7).
- CSV bulk import is parsed with a streaming parser, row-capped, and **never** evaluated. Formula
  injection is neutralised on export by prefixing cells beginning `= + - @`.

## 9. Mozambican regulatory context — flagged, not guessed

**This section identifies where local legal review is required. It is not legal advice, and I have
not guessed at conclusions.**

| Area                | What I know                                                                                                                                                                                   | What needs counsel                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data protection     | Mozambique lacks a single comprehensive GDPR-equivalent statute. Constitutional privacy protections, sectoral rules, and electronic transaction legislation apply, and the area is developing | Current obligations for a consumer marketplace; whether cross-border processing (AWS Cape Town) needs specific consent or notification; breach notification duties       |
| Financial services  | Payment aggregation is regulated. Operating as merchant of record and settling to vendors may carry obligations under Banco de Moçambique rules                                               | Whether our model requires a payments licence or can operate under the providers' merchant agreements — **this is the highest-consequence open question in the project** |
| Consumer protection | Distance-selling rules, return rights, and mandatory disclosures apply                                                                                                                        | Required return windows and disclosures; whether our 7-day dispute window meets the statutory minimum                                                                    |
| Tax / IVA           | Marketplace-facilitator rules determine whether the platform or each vendor remits IVA                                                                                                        | **OQ-10.** Drives whether tax is computed per-vendor or platform-wide — a data-model decision I have deliberately left configurable rather than guessing                 |
| KYC/AML             | Onboarding vendors who receive funds may trigger AML obligations                                                                                                                              | Required verification depth, record retention, suspicious-activity reporting                                                                                             |
| GDPR                | Attaches independently if you ever serve EU residents                                                                                                                                         | Whether your projected user base includes them                                                                                                                           |

**My approach:** build to GDPR-grade practice as the safe baseline — explicit consent, data
minimisation, export and deletion paths, audit logging, encryption — and flag rather than guess.
That baseline is at or above what any of these regimes is likely to require, so legal review is more
likely to relax a control than to demand a rebuild.

**The payments licensing question (row 2) should go to counsel before Phase 3 completes**, because
an answer of "you need a licence" changes the business model, not just the code.

## 10. Testing and verification

| Layer                       | When                                                           |
| --------------------------- | -------------------------------------------------------------- |
| SAST (CodeQL / Semgrep)     | Every PR                                                       |
| Dependency scan             | Every PR + daily                                               |
| Container scan (Trivy)      | Every build                                                    |
| IaC scan (tfsec, checkov)   | Every PR                                                       |
| Secret scan (gitleaks)      | Pre-commit + CI                                                |
| DAST (OWASP ZAP baseline)   | Nightly against staging                                        |
| **Manual penetration test** | **Before production payment credentials are used** — see below |

### Where manual penetration testing must happen

Automated scanning does not find the vulnerabilities that matter in this system: authorisation
logic, payment state manipulation, race conditions in checkout, and business-logic abuse. A scanner
cannot tell you that a vendor can read another vendor's orders.

**Required before go-live**, scoped to:

1. Authentication and OTP flows, including abuse and enumeration
2. Authorisation boundaries — buyer/vendor/admin isolation, IDOR across every resource
3. **Payment manipulation** — forged callbacks, replay, amount tampering, race conditions in
   concurrent checkout on the same variant
4. Vendor payout redirection paths
5. Mobile binary analysis

Sequence it **after** the real provider integration is complete in staging but **before** production
credentials go live. Testing the mock tells you the mock is safe.

---

**Next:** [06 · Infrastructure & Delivery](06-infrastructure.md)
