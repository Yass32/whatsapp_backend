-- AlterTable
ALTER TABLE "public"."Learner" ADD COLUMN     "adminId" INTEGER;

-- CreateIndex
CREATE INDEX "Learner_adminId_idx" ON "public"."Learner"("adminId");

-- AddForeignKey
ALTER TABLE "public"."Learner" ADD CONSTRAINT "Learner_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
