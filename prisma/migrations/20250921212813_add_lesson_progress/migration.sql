/*
  Warnings:

  - You are about to drop the `GroupMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."GroupMember" DROP CONSTRAINT "GroupMember_groupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GroupMember" DROP CONSTRAINT "GroupMember_learnerId_fkey";

-- DropTable
DROP TABLE "public"."GroupMember";

-- CreateTable
CREATE TABLE "public"."_GroupToLearner" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GroupToLearner_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GroupToLearner_B_index" ON "public"."_GroupToLearner"("B");

-- AddForeignKey
ALTER TABLE "public"."_GroupToLearner" ADD CONSTRAINT "_GroupToLearner_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GroupToLearner" ADD CONSTRAINT "_GroupToLearner_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
