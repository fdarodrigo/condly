import { PrismaService } from '../prisma/prisma.service';
import { Aviso, Usuario } from '../../generated/prisma/client';

/**
 * Destinatários do escopo do aviso: síndico e condômino(s) — a
 * Administradora normalmente é quem está criando o aviso, não um
 * destinatário dele. Escopo "unidade específica" só notifica o(s)
 * condômino(s) daquela unidade, nunca o síndico nem outras unidades do
 * mesmo condomínio.
 *
 * Extraído de `AvisosService` pra ser reutilizado por todo client de canal
 * que precise da mesma lista (ex: `WhatsappCloudApiAvisoClient`, que roda
 * fora do ciclo de request/response e por isso não tem um `tenantPrisma`
 * escopado por Guard — só o `aviso.condominioId`/`aviso.unidadeId`, que já
 * foram validados na criação do Aviso).
 */
export async function resolverDestinatariosDoAviso(
  aviso: Pick<Aviso, 'condominioId' | 'unidadeId'>,
  prisma: PrismaService,
): Promise<Usuario[]> {
  const vinculos = aviso.unidadeId
    ? await prisma.vinculoUsuario.findMany({
        where: { papel: 'CONDOMINO', unidadeId: aviso.unidadeId },
        include: { usuario: true },
      })
    : await prisma.vinculoUsuario.findMany({
        where: {
          OR: [
            { papel: 'SINDICO', condominioId: aviso.condominioId },
            { papel: 'CONDOMINO', unidade: { condominioId: aviso.condominioId } },
          ],
        },
        include: { usuario: true },
      });

  const usuariosPorId = new Map(vinculos.map((vinculo) => [vinculo.usuario.id, vinculo.usuario]));
  return Array.from(usuariosPorId.values());
}
