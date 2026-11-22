CREATE TABLE "ad_campaign" (
	"id" uuid PRIMARY KEY NOT NULL,
	"advertiser_name" text NOT NULL,
	"advertiser_contact" text,
	"image_url" text NOT NULL,
	"click_url" text NOT NULL,
	"headline" text,
	"placement" text NOT NULL,
	"category_slug" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price_cents" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_campaign_placement_check" CHECK ("ad_campaign"."placement" in ('leaderboard','mpu','inline')),
	CONSTRAINT "ad_campaign_status_check" CHECK ("ad_campaign"."status" in ('pending','active','paused','ended')),
	CONSTRAINT "ad_campaign_window_check" CHECK ("ad_campaign"."ends_at" > "ad_campaign"."starts_at")
);
--> statement-breakpoint
CREATE INDEX "ad_campaign_serve_idx" ON "ad_campaign" USING btree ("status","placement","category_slug");