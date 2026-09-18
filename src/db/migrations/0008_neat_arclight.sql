CREATE TABLE "crm"."assignment_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"target_entity" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assignment_strategy" text DEFAULT 'ROUND_ROBIN' NOT NULL,
	"candidate_user_ids" text[] DEFAULT '{}' NOT NULL,
	"last_assigned_user_id" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."assignment_rules" ADD CONSTRAINT "assignment_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assignment_rules_target" ON "crm"."assignment_rules" USING btree ("target_entity","is_active","priority");--> statement-breakpoint
CREATE INDEX "idx_assignment_rules_org" ON "crm"."assignment_rules" USING btree ("organization_id");