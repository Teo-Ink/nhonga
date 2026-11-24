-- P2-02: refunds of wallet top-ups and package purchases. One refund per
-- payment, for its full amount. The intent keeps status 'paid'/'review'; the
-- refund has its own state.
ALTER TABLE "checkout_intent" ADD COLUMN IF NOT EXISTS "refund_status" text;
ALTER TABLE "checkout_intent" ADD COLUMN IF NOT EXISTS "refund_amount_cents" bigint;
ALTER TABLE "checkout_intent" ADD COLUMN IF NOT EXISTS "refund_reason" text;
ALTER TABLE "checkout_intent" ADD COLUMN IF NOT EXISTS "refunded_at" timestamptz;
ALTER TABLE "checkout_intent" DROP CONSTRAINT IF EXISTS "checkout_intent_refund_status_check";
ALTER TABLE "checkout_intent" ADD CONSTRAINT "checkout_intent_refund_status_check"
  CHECK ("refund_status" IS NULL OR "refund_status" IN ('pending', 'refunded', 'failed'));
