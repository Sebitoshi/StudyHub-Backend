-- Migration: Sync schema with actual database state
-- This migration reconciles the schema history with the actual DB.
-- All tables already existed; only missing columns are added here.

-- Add benefits column to jobs table (was missing from initial creation)
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "benefits" TEXT[] DEFAULT '{}';

-- Add slug column to resumes table (if not exists)
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Add unique index on resumes.slug if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'resumes' AND indexname = 'resumes_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "resumes_slug_key" ON "resumes"("slug");
  END IF;
END$$;

-- Ensure enums exist (they should, but guard with DO blocks)
DO $$ BEGIN
  CREATE TYPE "JobApplicationStatus" AS ENUM ('SAVED', 'APPLIED', 'INTERVIEW', 'REJECTED', 'HIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('TASK_DUE', 'CLASS_REMINDER', 'ROADMAP_REMINDER', 'GROUP_SESSION', 'JOB_MATCH', 'INTERVIEW', 'KNOWLEDGE_GAP', 'EXAM_ALERT', 'STREAK_RISK');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
