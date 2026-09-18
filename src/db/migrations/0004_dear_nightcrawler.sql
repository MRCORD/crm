CREATE TABLE "crm"."views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"owner_id" text,
	"target_entity" text NOT NULL,
	"name" text NOT NULL,
	"view_type" text DEFAULT 'TABLE' NOT NULL,
	"filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"group_by_field" text,
	"visible_fields" text[] DEFAULT '{}' NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"position" double precision DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."views" ADD CONSTRAINT "views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."views" ADD CONSTRAINT "views_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "system"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_views_target_entity" ON "crm"."views" USING btree ("target_entity");--> statement-breakpoint
CREATE INDEX "idx_views_owner" ON "crm"."views" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_views_org" ON "crm"."views" USING btree ("organization_id");