-- CreateEnum
CREATE TYPE "TipoAssembleia" AS ENUM ('ORDINARIA', 'EXTRAORDINARIA');

-- CreateEnum
CREATE TYPE "StatusAssembleia" AS ENUM ('AGENDADA', 'REALIZADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Assembleia" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoAssembleia" NOT NULL,
    "status" "StatusAssembleia" NOT NULL DEFAULT 'AGENDADA',
    "dataHora" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "linkGravacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assembleia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PautaAssembleia" (
    "id" TEXT NOT NULL,
    "assembleiaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "deliberacao" TEXT,

    CONSTRAINT "PautaAssembleia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssembleiaDocumento" (
    "id" TEXT NOT NULL,
    "assembleiaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "AssembleiaDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assembleia_condominioId_idx" ON "Assembleia"("condominioId");

-- CreateIndex
CREATE INDEX "PautaAssembleia_assembleiaId_idx" ON "PautaAssembleia"("assembleiaId");

-- CreateIndex
CREATE INDEX "AssembleiaDocumento_assembleiaId_idx" ON "AssembleiaDocumento"("assembleiaId");

-- AddForeignKey
ALTER TABLE "Assembleia" ADD CONSTRAINT "Assembleia_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PautaAssembleia" ADD CONSTRAINT "PautaAssembleia_assembleiaId_fkey" FOREIGN KEY ("assembleiaId") REFERENCES "Assembleia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssembleiaDocumento" ADD CONSTRAINT "AssembleiaDocumento_assembleiaId_fkey" FOREIGN KEY ("assembleiaId") REFERENCES "Assembleia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
