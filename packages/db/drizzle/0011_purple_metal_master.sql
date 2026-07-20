ALTER TABLE "student_profiles" DROP CONSTRAINT "student_profiles_coordinator_id_unique";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "coordinator_id" DROP NOT NULL;