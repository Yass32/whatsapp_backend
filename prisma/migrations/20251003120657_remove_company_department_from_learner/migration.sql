/*
  Warnings:

  - You are about to drop the column `company` on the `Learner` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `Learner` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Learner" DROP COLUMN "company",
DROP COLUMN "department",
ALTER COLUMN "active" SET DEFAULT true;
