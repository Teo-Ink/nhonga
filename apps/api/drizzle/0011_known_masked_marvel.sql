CREATE TABLE "notification_pref" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"contact_enabled" boolean DEFAULT true NOT NULL,
	"review_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_pref" ADD CONSTRAINT "notification_pref_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;