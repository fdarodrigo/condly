-- CreateEnum
CREATE TYPE "PapelVinculo" AS ENUM ('ADMINISTRADORA', 'SINDICO', 'CONDOMINO');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'EM_ACORDO');

-- CreateEnum
CREATE TYPE "StatusChamado" AS ENUM ('PENDENTE_TRIAGEM', 'ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "CanalAviso" AS ENUM ('APP', 'EMAIL', 'WHATSAPP');

-- CreateTable
CREATE TABLE "Administradora" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "emailContato" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Administradora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condominio" (
    "id" TEXT NOT NULL,
    "administradoraId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "subcontaGatewayId" TEXT,

    CONSTRAINT "Condominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unidade" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "Unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefoneWhatsapp" TEXT,
    "senhaHash" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" "PapelVinculo" NOT NULL,
    "administradoraId" TEXT,
    "condominioId" TEXT,
    "unidadeId" TEXT,

    CONSTRAINT "VinculoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusCobranca" NOT NULL,
    "idExternoGateway" TEXT,
    "pagoEm" TIMESTAMP(3),

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "abertoPorId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "status" "StatusChamado" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "urlArquivo" TEXT NOT NULL,
    "visibilidade" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aviso" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "canais" "CanalAviso"[],
    "enviadoEm" TIMESTAMP(3),

    CONSTRAINT "Aviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaComum" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "regrasReserva" JSONB NOT NULL,

    CONSTRAINT "AreaComum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "areaComumId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversaBot" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "telefoneWhatsapp" TEXT NOT NULL,
    "mensagens" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversaBot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Condominio_cnpj_key" ON "Condominio"("cnpj");

-- CreateIndex
CREATE INDEX "Condominio_administradoraId_idx" ON "Condominio"("administradoraId");

-- CreateIndex
CREATE INDEX "Unidade_condominioId_idx" ON "Unidade"("condominioId");

-- CreateIndex
CREATE UNIQUE INDEX "Unidade_condominioId_identificador_key" ON "Unidade"("condominioId", "identificador");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "VinculoUsuario_usuarioId_idx" ON "VinculoUsuario"("usuarioId");

-- CreateIndex
CREATE INDEX "VinculoUsuario_administradoraId_idx" ON "VinculoUsuario"("administradoraId");

-- CreateIndex
CREATE INDEX "VinculoUsuario_condominioId_idx" ON "VinculoUsuario"("condominioId");

-- CreateIndex
CREATE INDEX "VinculoUsuario_unidadeId_idx" ON "VinculoUsuario"("unidadeId");

-- CreateIndex
CREATE INDEX "Cobranca_unidadeId_idx" ON "Cobranca"("unidadeId");

-- CreateIndex
CREATE INDEX "Chamado_condominioId_idx" ON "Chamado"("condominioId");

-- CreateIndex
CREATE INDEX "Chamado_unidadeId_idx" ON "Chamado"("unidadeId");

-- CreateIndex
CREATE INDEX "Chamado_abertoPorId_idx" ON "Chamado"("abertoPorId");

-- CreateIndex
CREATE INDEX "Documento_condominioId_idx" ON "Documento"("condominioId");

-- CreateIndex
CREATE INDEX "Aviso_condominioId_idx" ON "Aviso"("condominioId");

-- CreateIndex
CREATE INDEX "Aviso_unidadeId_idx" ON "Aviso"("unidadeId");

-- CreateIndex
CREATE INDEX "AreaComum_condominioId_idx" ON "AreaComum"("condominioId");

-- CreateIndex
CREATE INDEX "Reserva_areaComumId_idx" ON "Reserva"("areaComumId");

-- CreateIndex
CREATE INDEX "Reserva_unidadeId_idx" ON "Reserva"("unidadeId");

-- CreateIndex
CREATE INDEX "ConversaBot_unidadeId_idx" ON "ConversaBot"("unidadeId");

-- AddForeignKey
ALTER TABLE "Condominio" ADD CONSTRAINT "Condominio_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "Administradora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unidade" ADD CONSTRAINT "Unidade_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoUsuario" ADD CONSTRAINT "VinculoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoUsuario" ADD CONSTRAINT "VinculoUsuario_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "Administradora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoUsuario" ADD CONSTRAINT "VinculoUsuario_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoUsuario" ADD CONSTRAINT "VinculoUsuario_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaComum" ADD CONSTRAINT "AreaComum_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_areaComumId_fkey" FOREIGN KEY ("areaComumId") REFERENCES "AreaComum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaBot" ADD CONSTRAINT "ConversaBot_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
