/*
  Warnings:

  - You are about to drop the `_GroupToLearner` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."_GroupToLearner" DROP CONSTRAINT "_GroupToLearner_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_GroupToLearner" DROP CONSTRAINT "_GroupToLearner_B_fkey";

-- DropTable
DROP TABLE "public"."_GroupToLearner";

-- CreateTable
CREATE TABLE "public"."GroupMember" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "learnerId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "public"."GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_learnerId_idx" ON "public"."GroupMember"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_learnerId_key" ON "public"."GroupMember"("groupId", "learnerId");

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "public"."Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
