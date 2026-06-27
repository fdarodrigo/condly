-- DropForeignKey
ALTER TABLE "ConversaBot" DROP CONSTRAINT "ConversaBot_unidadeId_fkey";

-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN     "linkPagamento" TEXT;

-- AlterTable
ALTER TABLE "ConversaBot" ALTER COLUMN "unidadeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ConversaBot_telefoneWhatsapp_idx" ON "ConversaBot"("telefoneWhatsapp");

-- AddForeignKey
ALTER TABLE "ConversaBot" ADD CONSTRAINT "ConversaBot_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
