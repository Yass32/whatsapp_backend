/*
  Custom migration to safely update Department enum values
  - Adds new capitalized enum values
  - Updates existing data to use appropriate new values
  - Removes old enum values
*/

-- Step 1: Add new enum values to existing enum type
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'Akademi';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'Eğitim';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'Gelişim';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'Other';

-- Step 2: Update existing data to use new values
-- Map old lowercase values to new capitalized values
UPDATE "Admin" SET "department" = 'Other' WHERE "department" = 'other';
UPDATE "Admin" SET "department" = 'Other' WHERE "department" IN ('marketing', 'it', 'learning');

-- Step 3: Update the default value to use capitalized 'Other'
ALTER TABLE "Admin" ALTER COLUMN "department" SET DEFAULT 'Other';
