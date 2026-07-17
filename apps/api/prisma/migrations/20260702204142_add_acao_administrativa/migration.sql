-- CreateTable
CREATE TABLE "AcaoAdministrativa" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "realizadaEm" DATE NOT NULL,
    "validoAte" DATE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcaoAdministrativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcaoAdministrativa_condominioId_idx" ON "AcaoAdministrativa"("condominioId");

-- AddForeignKey
ALTER TABLE "AcaoAdministrativa" ADD CONSTRAINT "AcaoAdministrativa_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
