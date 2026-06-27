-- CreateTable
CREATE TABLE "ServicoPeriodico" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "proximoVencimento" DATE NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicoPeriodico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicoPeriodico_condominioId_idx" ON "ServicoPeriodico"("condominioId");

-- AddForeignKey
ALTER TABLE "ServicoPeriodico" ADD CONSTRAINT "ServicoPeriodico_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
