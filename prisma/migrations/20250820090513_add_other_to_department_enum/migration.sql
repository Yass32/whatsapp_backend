/*
  Warnings:

  - Made the column `department` on table `Learner` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "public"."Department" ADD VALUE 'other';

-- AlterTable
ALTER TABLE "public"."Learner" ALTER COLUMN "department" SET NOT NULL;
