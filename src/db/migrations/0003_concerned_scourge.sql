CREATE TABLE "crm"."timeline_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"actor_source" text DEFAULT 'SYSTEM' NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"happened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."companies" ALTER COLUMN "owner_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ALTER COLUMN "owner_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "crm"."tasks" ALTER COLUMN "assignee_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mcp"."mcp_approvals" ALTER COLUMN "assigned_to_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mcp"."mcp_clients" ALTER COLUMN "api_key_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "crm"."timeline_activities" ADD CONSTRAINT "timeline_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."timeline_activities" ADD CONSTRAINT "timeline_activities_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "system"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_timeline_entity" ON "crm"."timeline_activities" USING btree ("entity_type","entity_id","happened_at");--> statement-breakpoint
CREATE INDEX "idx_timeline_org" ON "crm"."timeline_activities" USING btree ("organization_id");