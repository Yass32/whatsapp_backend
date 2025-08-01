/*
  Warnings:

  - You are about to drop the column `timestamp` on the `Message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "timestamp",
ADD COLUMN     "localtime" TIMESTAMP(3);
