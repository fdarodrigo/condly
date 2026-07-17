-- CreateTable
CREATE TABLE "DadosUnidade" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "bebeRecemNascido" BOOLEAN NOT NULL DEFAULT false,
    "trabalhadorNoturno" BOOLEAN NOT NULL DEFAULT false,
    "pessoasIdosas" BOOLEAN NOT NULL DEFAULT false,
    "pets" BOOLEAN NOT NULL DEFAULT false,
    "petsDescricao" TEXT,
    "pessoasAutismo" BOOLEAN NOT NULL DEFAULT false,
    "pessoasAutismoDescricao" TEXT,
    "estrangeiros" BOOLEAN NOT NULL DEFAULT false,
    "mobilidadeReduzida" BOOLEAN NOT NULL DEFAULT false,
    "locacaoCurtaTemporada" BOOLEAN NOT NULL DEFAULT false,
    "statusOcupacao" TEXT NOT NULL DEFAULT 'PROPRIETARIO',
    "veiculos" JSONB NOT NULL DEFAULT '[]',
    "contatoEmergenciaNome" TEXT,
    "contatoEmergenciaTelefone" TEXT,

    CONSTRAINT "DadosUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DadosUnidade_unidadeId_key" ON "DadosUnidade"("unidadeId");

-- AddForeignKey
ALTER TABLE "DadosUnidade" ADD CONSTRAINT "DadosUnidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
