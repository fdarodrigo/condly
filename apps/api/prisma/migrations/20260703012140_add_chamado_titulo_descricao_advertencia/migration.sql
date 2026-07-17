-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "titulo" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Advertencia" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "remetenteId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Advertencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Advertencia_condominioId_idx" ON "Advertencia"("condominioId");

-- CreateIndex
CREATE INDEX "Advertencia_unidadeId_idx" ON "Advertencia"("unidadeId");

-- CreateIndex
CREATE INDEX "Advertencia_remetenteId_idx" ON "Advertencia"("remetenteId");

-- CreateIndex
CREATE INDEX "Chamado_categoria_idx" ON "Chamado"("categoria");

-- AddForeignKey
ALTER TABLE "Advertencia" ADD CONSTRAINT "Advertencia_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertencia" ADD CONSTRAINT "Advertencia_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertencia" ADD CONSTRAINT "Advertencia_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
