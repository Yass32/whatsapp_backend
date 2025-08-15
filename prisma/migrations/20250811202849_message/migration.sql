/*
  Warnings:

  - A unique constraint covering the columns `[messageId]` on the table `MessageContext` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "MessageContext_messageId_key" ON "public"."MessageContext"("messageId");
