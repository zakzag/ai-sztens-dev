-- Guarded by hand, exactly like migration 0002 (AIS-39/AIS-18): on an existing
-- volume `infra/postgres/init/02-schemas.sh` has already created these schemas,
-- and an unguarded `CREATE SCHEMA` would abort the whole migration there.
CREATE SCHEMA IF NOT EXISTS "customer";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "iam";
--> statement-breakpoint
CREATE TYPE "customer"."contact_role" AS ENUM('primary', 'technical', 'alerting');--> statement-breakpoint
CREATE TYPE "customer"."customer_source" AS ENUM('website', 'referral', 'in_person', 'questionnaire', 'partner', 'manual');--> statement-breakpoint
CREATE TYPE "customer"."customer_status" AS ENUM('prospect', 'registered', 'trial', 'active', 'suspended', 'churned', 'anonymized');--> statement-breakpoint
CREATE TYPE "customer"."customer_type" AS ENUM('company', 'sole_proprietor', 'organization', 'tax_number_individual');--> statement-breakpoint
CREATE TYPE "iam"."customer_user_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "iam"."customer_user_status" AS ENUM('invited', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "customer"."headcount_range" AS ENUM('sole', '2_5', '6_20');--> statement-breakpoint
CREATE TYPE "iam"."operator_role" AS ENUM('superadmin', 'operator');--> statement-breakpoint
CREATE TABLE "customer"."contact_roles" (
	"contact_id" uuid NOT NULL,
	"role" "customer"."contact_role" NOT NULL,
	"customer_id" uuid NOT NULL,
	CONSTRAINT "contact_roles_pkey" PRIMARY KEY("contact_id","role")
);
--> statement-breakpoint
CREATE TABLE "customer"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"email" text,
	"phone" text,
	"customer_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "contacts_id_customer_id_key" UNIQUE("id","customer_id")
);
--> statement-breakpoint
CREATE TABLE "customer"."customer_tags" (
	"customer_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "customer_tags_pkey" PRIMARY KEY("customer_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "iam"."customer_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "iam"."customer_user_role" NOT NULL,
	"status" "iam"."customer_user_status" NOT NULL,
	"invited_by_operator_id" uuid,
	"invited_at" timestamp (3) with time zone,
	"accepted_at" timestamp (3) with time zone,
	"last_login_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_users_customer_id_id_key" UNIQUE("customer_id","id")
);
--> statement-breakpoint
CREATE TABLE "customer"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_number" text NOT NULL,
	"type" "customer"."customer_type" NOT NULL,
	"legal_name" text NOT NULL,
	"short_name" text,
	"tax_number" text,
	"eu_vat_number" text,
	"company_registration_number" text,
	"legal_form" text,
	"registered_address_zip" text,
	"registered_address_city" text,
	"registered_address_line" text,
	"registered_address_country" text DEFAULT 'HU' NOT NULL,
	"industry" text,
	"headcount_range" "customer"."headcount_range",
	"source" "customer"."customer_source",
	"responsible_operator_id" uuid,
	"status" "customer"."customer_status" NOT NULL,
	"status_changed_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "customers_customer_number_key" UNIQUE("customer_number"),
	CONSTRAINT "customers_tax_number_format_check" CHECK ("customer"."customers"."tax_number" IS NULL OR "customer"."customers"."tax_number" ~ '^\d{8}-[1-5]-\d{2}$')
);
--> statement-breakpoint
CREATE TABLE "iam"."operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "iam"."operator_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "operators_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "customer"."tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tags_name_key" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "customer"."contact_roles" ADD CONSTRAINT "contact_roles_contact_id_fkey" FOREIGN KEY ("contact_id","customer_id") REFERENCES "customer"."contacts"("id","customer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."contacts" ADD CONSTRAINT "contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."contacts" ADD CONSTRAINT "contacts_customer_user_id_fkey" FOREIGN KEY ("customer_id","customer_user_id") REFERENCES "iam"."customer_users"("customer_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."customer_tags" ADD CONSTRAINT "customer_tags_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."customer_tags" ADD CONSTRAINT "customer_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "customer"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."customer_users" ADD CONSTRAINT "customer_users_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."customer_users" ADD CONSTRAINT "customer_users_invited_by_operator_id_operators_id_fk" FOREIGN KEY ("invited_by_operator_id") REFERENCES "iam"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."customers" ADD CONSTRAINT "customers_responsible_operator_id_operators_id_fk" FOREIGN KEY ("responsible_operator_id") REFERENCES "iam"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_roles_primary_key" ON "customer"."contact_roles" USING btree ("customer_id") WHERE "customer"."contact_roles"."role" = 'primary';--> statement-breakpoint
CREATE INDEX "contacts_customer_id_name_idx" ON "customer"."contacts" USING btree ("customer_id","name");--> statement-breakpoint
CREATE INDEX "customer_tags_tag_id_idx" ON "customer"."customer_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_users_email_key" ON "iam"."customer_users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "customer_users_customer_owner_key" ON "iam"."customer_users" USING btree ("customer_id") WHERE "iam"."customer_users"."role" = 'owner' AND "iam"."customer_users"."status" = 'active';--> statement-breakpoint
CREATE INDEX "customer_users_customer_id_idx" ON "iam"."customer_users" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tax_number_key" ON "customer"."customers" USING btree ("tax_number") WHERE "customer"."customers"."tax_number" IS NOT NULL AND "customer"."customers"."deleted_at" IS NULL;