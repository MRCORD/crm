CREATE TABLE "crm"."dashboard_widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"widget_type" text NOT NULL,
	"title" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"owner_id" text,
	"name" text NOT NULL,
	"description" text,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."field_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"entity_type" text NOT NULL,
	"field_name" text NOT NULL,
	"role" text NOT NULL,
	"can_read" boolean DEFAULT true NOT NULL,
	"can_write" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."companies" ADD COLUMN "visibility" text DEFAULT 'OPEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD COLUMN "visibility" text DEFAULT 'OPEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm"."dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "crm"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."dashboards" ADD CONSTRAINT "dashboards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."dashboards" ADD CONSTRAINT "dashboards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "system"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."field_permissions" ADD CONSTRAINT "field_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dashboard_widgets_dash" ON "crm"."dashboard_widgets" USING btree ("dashboard_id");--> statement-breakpoint
CREATE INDEX "idx_field_perms_role" ON "crm"."field_permissions" USING btree ("entity_type","role");--> statement-breakpoint
CREATE INDEX "idx_field_perms_org" ON "crm"."field_permissions" USING btree ("organization_id");