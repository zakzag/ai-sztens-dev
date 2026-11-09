ALTER TABLE "platform"."api_keys" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "api_keys_deleted_at_idx" ON "platform"."api_keys" USING btree ("deleted_at");