-- Hand-edited: the generated NOT NULL column fails on a table that already
-- holds users, so existing rows get the part of their email before "@" first.
ALTER TABLE "users" ADD COLUMN "name" text;--> statement-breakpoint
UPDATE "users" SET "name" = split_part("email", '@', 1);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
