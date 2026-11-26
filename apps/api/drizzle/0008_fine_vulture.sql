ALTER TABLE "customer"."customers" DROP CONSTRAINT "customers_responsible_operator_id_operators_id_fk";
--> statement-breakpoint
ALTER TABLE "customer"."customers" DROP COLUMN "responsible_operator_id";