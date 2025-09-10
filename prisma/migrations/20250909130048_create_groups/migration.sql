-- CreateTable
CREATE TABLE "public"."Group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GroupMember" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "learnerId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GroupCourse" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Group_adminId_idx" ON "public"."Group"("adminId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "public"."GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_learnerId_idx" ON "public"."GroupMember"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_learnerId_key" ON "public"."GroupMember"("groupId", "learnerId");

-- CreateIndex
CREATE INDEX "GroupCourse_groupId_idx" ON "public"."GroupCourse"("groupId");

-- CreateIndex
CREATE INDEX "GroupCourse_courseId_idx" ON "public"."GroupCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupCourse_groupId_courseId_key" ON "public"."GroupCourse"("groupId", "courseId");

-- CreateIndex
CREATE INDEX "Course_adminId_idx" ON "public"."Course"("adminId");

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "public"."Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupCourse" ADD CONSTRAINT "GroupCourse_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupCourse" ADD CONSTRAINT "GroupCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
