CREATE TABLE "crm"."merge_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"entity_type" text NOT NULL,
	"primary_record_id" uuid NOT NULL,
	"duplicate_record_id" uuid NOT NULL,
	"confidence_score" numeric(3, 2) NOT NULL,
	"match_reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."merge_candidates" ADD CONSTRAINT "merge_candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."merge_candidates" ADD CONSTRAINT "merge_candidates_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "system"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_merge_status" ON "crm"."merge_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_merge_entity" ON "crm"."merge_candidates" USING btree ("entity_type","primary_record_id");--> statement-breakpoint
CREATE INDEX "idx_merge_org" ON "crm"."merge_candidates" USING btree ("organization_id");