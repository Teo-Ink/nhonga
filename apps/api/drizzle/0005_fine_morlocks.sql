CREATE TABLE "listing_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid,
	"product_slug" text NOT NULL,
	"reporter_user_id" uuid,
	"reason" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_report_reason_check" CHECK ("listing_report"."reason" in ('fraud','prohibited','spam','wrong_category','offensive','other')),
	CONSTRAINT "listing_report_status_check" CHECK ("listing_report"."status" in ('open','reviewed','dismissed'))
);
--> statement-breakpoint
ALTER TABLE "listing_report" ADD CONSTRAINT "listing_report_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_report" ADD CONSTRAINT "listing_report_reporter_user_id_app_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_report_status_idx" ON "listing_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listing_report_product_idx" ON "listing_report" USING btree ("product_id");