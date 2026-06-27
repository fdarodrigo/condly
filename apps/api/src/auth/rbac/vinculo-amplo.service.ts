import { Injectable } from '@nestjs/common';
import { TenantPrismaClient } from '../../prisma/tenant-prisma';
import { AuthenticatedUser } from '../types/auth.types';

/**
 * "Vínculo amplo" num condomínio = SINDICO daquele condomínio, ou
 * ADMINISTRADORA da administradora QUE É DONA daquele condomínio
 * especificamente — não basta "ter algum vínculo ADMINISTRADORA", senão um
 * usuário ADMINISTRADORA de uma administradora diferente ganharia acesso
 * amplo a um condomínio que não é dela (bug corrigido no Prompt B). Por
 * isso a comparação busca o `administradoraId` do condomínio em questão
 * antes de validar o vínculo, em vez de só checar o papel.
 *
 * Usado por ChamadosService.listar e DocumentosService para decidir quem
 * vê o recurso inteiro de um condomínio, em vez de só o que pertence à
 * própria unidade (CONDOMINO).
 */
@Injectable()
export class VinculoAmploService {
  async possui(
    usuario: AuthenticatedUser,
    condominioId: string,
    tenantPrisma: TenantPrismaClient,
  ): Promise<boolean> {
    const temVinculoAdministradora = usuario.vinculos.some(
      (vinculo) => vinculo.papel === 'ADMINISTRADORA',
    );
    // Só busca o condomínio se houver um vínculo ADMINISTRADORA a verificar —
    // evita a query extra no caso comum (SINDICO já resolve por condominioId
    // direto, sem precisar saber a administradoraId).
    const administradoraIdDoCondominio = temVinculoAdministradora
      ? (await tenantPrisma.condominio.findUnique({ where: { id: condominioId } }))
          ?.administradoraId
      : undefined;

    return usuario.vinculos.some((vinculo) => {
      if (vinculo.papel === 'SINDICO') {
        return vinculo.condominioId === condominioId;
      }
      if (vinculo.papel === 'ADMINISTRADORA') {
        return vinculo.administradoraId === administradoraIdDoCondominio;
      }
      return false;
    });
  }
}
