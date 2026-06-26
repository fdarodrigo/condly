/*
  Warnings:

  - Changed the type of `visibilidade` on the `Documento` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "VisibilidadeDocumento" AS ENUM ('TODOS', 'SINDICO_ADMINISTRADORA');

-- AlterTable
ALTER TABLE "Documento" DROP COLUMN "visibilidade",
ADD COLUMN     "visibilidade" "VisibilidadeDocumento" NOT NULL;
