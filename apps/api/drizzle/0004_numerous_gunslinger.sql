ALTER TABLE "platform"."api_keys" ALTER COLUMN "expires_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone;