-- DropForeignKey
ALTER TABLE "public"."MessageContext" DROP CONSTRAINT "MessageContext_courseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MessageContext" DROP CONSTRAINT "MessageContext_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MessageContext" DROP CONSTRAINT "MessageContext_quizId_fkey";

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "totalQuizzes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."CourseProgress" ADD COLUMN     "quizScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "public"."MessageContext" ADD CONSTRAINT "MessageContext_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageContext" ADD CONSTRAINT "MessageContext_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageContext" ADD CONSTRAINT "MessageContext_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "public"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
