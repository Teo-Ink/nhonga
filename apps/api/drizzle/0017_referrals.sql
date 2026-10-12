-- Referral attribution + rewards (H). One row per referred user (unique), so a
-- person can only be attributed once.
CREATE TABLE IF NOT EXISTS "referral" (
  "id" uuid PRIMARY KEY NOT NULL,
  "referrer_user_id" uuid NOT NULL,
  "referred_user_id" uuid NOT NULL,
  "code" text NOT NULL,
  "reward_points" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_user_unique" UNIQUE ("referred_user_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_fk"
    FOREIGN KEY ("referrer_user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_fk"
    FOREIGN KEY ("referred_user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "referral" ADD CONSTRAINT "referral_status_check"
    CHECK ("status" in ('pending','rewarded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "referral_referrer_idx" ON "referral" ("referrer_user_id");
