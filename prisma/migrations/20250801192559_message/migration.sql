/*
  Warnings:

  - The `timestamp` column on the `Message` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "timestamp",
ADD COLUMN     "timestamp" TIMESTAMP(3);
