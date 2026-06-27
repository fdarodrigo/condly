-- CreateTable
CREATE TABLE "AvisoLeitura" (
    "id" TEXT NOT NULL,
    "avisoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "lidoEm" TIMESTAMP(3),

    CONSTRAINT "AvisoLeitura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvisoLeitura_avisoId_idx" ON "AvisoLeitura"("avisoId");

-- CreateIndex
CREATE INDEX "AvisoLeitura_usuarioId_idx" ON "AvisoLeitura"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "AvisoLeitura_avisoId_usuarioId_key" ON "AvisoLeitura"("avisoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "AvisoLeitura" ADD CONSTRAINT "AvisoLeitura_avisoId_fkey" FOREIGN KEY ("avisoId") REFERENCES "Aviso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisoLeitura" ADD CONSTRAINT "AvisoLeitura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
