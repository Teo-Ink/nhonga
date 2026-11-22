-- Hosted-checkout payment intents (PawaPay primary, PaySuite backup).
-- Hand-written and idempotent like 0016/0017; applied by
-- scripts/apply-manual-migrations.mjs (dev-start runs it before the API).
CREATE TABLE IF NOT EXISTS "checkout_intent" (
  "id" uuid PRIMARY KEY NOT NULL,
  "purpose" text NOT NULL,
  "vendor_id" uuid,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "amount_cents" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'MZN',
  "method" text NOT NULL,
  "gateway" text NOT NULL,
  "gateway_ref" text,
  "checkout_url" text,
  "status" text NOT NULL DEFAULT 'pending',
  "failure_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "paid_at" timestamptz
);

DO $$ BEGIN
  ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_gateway_ref_unique"
    UNIQUE ("gateway", "gateway_ref");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_status_check"
    CHECK ("status" in ('pending','paid','failed','expired','review'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_amount_check"
    CHECK ("amount_cents" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_vendor_fk"
    FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "checkout_intent_status_idx" ON "checkout_intent" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "checkout_intent_vendor_idx" ON "checkout_intent" ("vendor_id", "created_at");
