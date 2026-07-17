-- CreateEnum
CREATE TYPE "TipoEnquete" AS ENUM ('GESTAO', 'SERVICO');

-- CreateEnum
CREATE TYPE "StatusEnquete" AS ENUM ('RASCUNHO', 'ATIVA', 'ENCERRADA');

-- CreateTable
CREATE TABLE "Enquete" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoEnquete" NOT NULL,
    "status" "StatusEnquete" NOT NULL DEFAULT 'RASCUNHO',
    "anonima" BOOLEAN NOT NULL DEFAULT false,
    "inicioEm" DATE NOT NULL,
    "fimEm" DATE NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpcaoEnquete" (
    "id" TEXT NOT NULL,
    "enqueteId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "OpcaoEnquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotoEnquete" (
    "id" TEXT NOT NULL,
    "enqueteId" TEXT NOT NULL,
    "opcaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "votadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotoEnquete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enquete_condominioId_idx" ON "Enquete"("condominioId");

-- CreateIndex
CREATE INDEX "OpcaoEnquete_enqueteId_idx" ON "OpcaoEnquete"("enqueteId");

-- CreateIndex
CREATE INDEX "VotoEnquete_enqueteId_idx" ON "VotoEnquete"("enqueteId");

-- CreateIndex
CREATE INDEX "VotoEnquete_opcaoId_idx" ON "VotoEnquete"("opcaoId");

-- CreateIndex
CREATE UNIQUE INDEX "VotoEnquete_enqueteId_usuarioId_key" ON "VotoEnquete"("enqueteId", "usuarioId");

-- AddForeignKey
ALTER TABLE "Enquete" ADD CONSTRAINT "Enquete_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpcaoEnquete" ADD CONSTRAINT "OpcaoEnquete_enqueteId_fkey" FOREIGN KEY ("enqueteId") REFERENCES "Enquete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotoEnquete" ADD CONSTRAINT "VotoEnquete_enqueteId_fkey" FOREIGN KEY ("enqueteId") REFERENCES "Enquete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotoEnquete" ADD CONSTRAINT "VotoEnquete_opcaoId_fkey" FOREIGN KEY ("opcaoId") REFERENCES "OpcaoEnquete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotoEnquete" ADD CONSTRAINT "VotoEnquete_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
