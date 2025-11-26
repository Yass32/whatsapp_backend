-- DropForeignKey
ALTER TABLE "public"."MessageContext" DROP CONSTRAINT "MessageContext_messageId_fkey";

-- AddForeignKey
ALTER TABLE "public"."MessageContext" ADD CONSTRAINT "MessageContext_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("messageId") ON DELETE CASCADE ON UPDATE CASCADE;
