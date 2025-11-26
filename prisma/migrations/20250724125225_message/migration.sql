-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('sent', 'delivered', 'read', 'failed', 'received', 'other');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('outgoing', 'incoming');

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "body" TEXT,
    "type" TEXT,
    "direction" "MessageDirection",
    "status" "MessageStatus",
    "timestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
