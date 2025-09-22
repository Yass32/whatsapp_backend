/*
  Warnings:

  - You are about to drop the column `attempts` on the `LessonProgress` table. All the data in the column will be lost.
  - You are about to drop the column `timeSpent` on the `LessonProgress` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[learnerId,courseId]` on the table `CourseProgress` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."LessonProgress" DROP COLUMN "attempts",
DROP COLUMN "timeSpent";

-- CreateIndex
CREATE INDEX "CourseProgress_learnerId_idx" ON "public"."CourseProgress"("learnerId");

-- CreateIndex
CREATE INDEX "CourseProgress_courseId_idx" ON "public"."CourseProgress"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseProgress_learnerId_courseId_key" ON "public"."CourseProgress"("learnerId", "courseId");
