/*
  Warnings:

  - The values [marketing,it,learning,other] on the enum `Department` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Department_new" AS ENUM ('Akademi', 'Eğitim_Gelişim', 'Pazarlama', 'İK', 'Diğer');
ALTER TABLE "public"."Admin" ALTER COLUMN "department" DROP DEFAULT;
ALTER TABLE "Admin" ALTER COLUMN "department" TYPE "Department_new" USING ("department"::text::"Department_new");
ALTER TYPE "Department" RENAME TO "Department_old";
ALTER TYPE "Department_new" RENAME TO "Department";
DROP TYPE "public"."Department_old";
ALTER TABLE "Admin" ALTER COLUMN "department" SET DEFAULT 'Diğer';
COMMIT;

-- AlterTable
ALTER TABLE "Admin" ALTER COLUMN "department" SET DEFAULT 'Diğer';
