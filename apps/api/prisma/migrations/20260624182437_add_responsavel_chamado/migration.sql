-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN     "responsavelId" TEXT;

-- CreateIndex
CREATE INDEX "Chamado_responsavelId_idx" ON "Chamado"("responsavelId");

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
