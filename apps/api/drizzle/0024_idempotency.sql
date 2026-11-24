-- P2-11: Idempotency-Key on the endpoints that move money. A repeated request
-- (a retry after a dropped connection, a double tap) replays the first answer
-- instead of charging twice. Records are kept 24 hours.
CREATE TABLE IF NOT EXISTS "idempotency_record" (
  "key_hash" text PRIMARY KEY,
  "request_hash" text NOT NULL,
  "status_code" integer,
  "response_body" text,
  "content_type" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idempotency_record_created_idx" ON "idempotency_record" ("created_at");
