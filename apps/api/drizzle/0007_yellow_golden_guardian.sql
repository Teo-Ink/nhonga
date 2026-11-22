CREATE TABLE "saved_search" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone_e164" text NOT NULL,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"query" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_run_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "saved_search_phone_idx" ON "saved_search" USING btree ("phone_e164");