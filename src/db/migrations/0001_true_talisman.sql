ALTER TABLE "system"."api_keys" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "system"."api_keys" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "system"."api_keys" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "system"."users" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "system"."users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "system"."users" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "crm"."companies" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."companies" ADD CONSTRAINT "companies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "system"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "system"."users"("id") ON DELETE set null ON UPDATE no action;