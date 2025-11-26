/*
  Warnings:

  - The `department` column on the `Admin` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "department",
ADD COLUMN     "department" TEXT NOT NULL DEFAULT 'Diğer';

-- DropEnum
DROP TYPE "public"."Department";
