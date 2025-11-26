/*
  Warnings:

  - You are about to drop the column `totalLessons` on the `CourseProgress` table. All the data in the column will be lost.
  - You are about to drop the `LessonProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."LessonProgress" DROP CONSTRAINT "LessonProgress_learnerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LessonProgress" DROP CONSTRAINT "LessonProgress_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LessonProgress" DROP CONSTRAINT "LessonProgress_quizId_fkey";

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "totalLessons" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."CourseProgress" DROP COLUMN "totalLessons";

-- DropTable
DROP TABLE "public"."LessonProgress";

-- CreateTable
CREATE TABLE "public"."MessageContext" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "courseId" INTEGER NOT NULL,
    "lessonId" INTEGER,
    "quizId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageContext_messageId_key" ON "public"."MessageContext"("messageId");

-- CreateIndex
CREATE INDEX "MessageContext_phoneNumber_idx" ON "public"."MessageContext"("phoneNumber");

-- CreateIndex
CREATE INDEX "MessageContext_courseId_idx" ON "public"."MessageContext"("courseId");

-- AddForeignKey
ALTER TABLE "public"."MessageContext" ADD CONSTRAINT "MessageContext_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("messageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageContext" ADD CONSTRAINT "MessageContext_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageContext" ADD CONSTRAINT "MessageContext_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageContext" ADD CONSTRAINT "MessageContext_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "public"."Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;
