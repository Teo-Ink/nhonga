-- P0-04: counters for the limits that must hold across every API instance
-- (src/common/shared-limit.ts). UNLOGGED: losing them in a crash only resets
-- a few windows, and it skips the write-ahead log on every hit.
CREATE UNLOGGED TABLE IF NOT EXISTS "rate_limit_bucket" (
  "key" text NOT NULL,
  "window_start" timestamptz NOT NULL,
  "hits" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("key", "window_start")
);
CREATE INDEX IF NOT EXISTS "rate_limit_bucket_window_idx" ON "rate_limit_bucket" ("window_start");
