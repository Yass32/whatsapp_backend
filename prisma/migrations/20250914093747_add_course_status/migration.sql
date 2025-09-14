-- CreateEnum
CREATE TYPE "public"."CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "status" "public"."CourseStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "public"."Course"("status");
