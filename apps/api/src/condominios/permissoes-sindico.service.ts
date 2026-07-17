import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PermissoesSindico {
  // Dashboard
  podeVerFinanceiro: boolean;

  // Chamados
  chamadosCriar: boolean;
  chamadosAlterarStatus: boolean;
  chamadosExcluir: boolean;

  // Avisos
  avisosCriar: boolean;
  avisosEditar: boolean;
  avisosExcluir: boolean;

  // Enquetes
  enquetesCriar: boolean;
  enquetesEncerrar: boolean;
  enquetesExcluir: boolean;

  // Assembleias
  assembleiasCriar: boolean;
  assembleiasRegistrarResultados: boolean;
  assembleiasCancelar: boolean;
  assembleiasExcluir: boolean;

  // Advertências
  advertenciasCriar: boolean;
  advertenciasExcluir: boolean;

  // Ações Administrativas
  acoesAdmCriar: boolean;
  acoesAdmExcluir: boolean;

  // Reservas
  reservasCancelar: boolean;
}

export const PERMISSOES_PADRAO: PermissoesSindico = {
  podeVerFinanceiro: true,
  chamadosCriar: true,
  chamadosAlterarStatus: true,
  chamadosExcluir: true,
  avisosCriar: true,
  avisosEditar: true,
  avisosExcluir: true,
  enquetesCriar: true,
  enquetesEncerrar: true,
  enquetesExcluir: true,
  assembleiasCriar: true,
  assembleiasRegistrarResultados: true,
  assembleiasCancelar: true,
  assembleiasExcluir: true,
  advertenciasCriar: true,
  advertenciasExcluir: true,
  acoesAdmCriar: true,
  acoesAdmExcluir: true,
  reservasCancelar: true,
};

// Nomes legíveis pro frontend (usado na tela de perfil).
export const PERMISSAO_LABELS: Record<keyof PermissoesSindico, string> = {
  podeVerFinanceiro: 'Ver resumo financeiro',
  chamadosCriar: 'Abrir chamados',
  chamadosAlterarStatus: 'Alterar status de chamados',
  chamadosExcluir: 'Excluir chamados',
  avisosCriar: 'Criar avisos',
  avisosEditar: 'Editar avisos',
  avisosExcluir: 'Excluir avisos',
  enquetesCriar: 'Criar enquetes',
  enquetesEncerrar: 'Encerrar enquetes',
  enquetesExcluir: 'Excluir enquetes',
  assembleiasCriar: 'Criar assembleias',
  assembleiasRegistrarResultados: 'Registrar resultados de assembleias',
  assembleiasCancelar: 'Cancelar assembleias',
  assembleiasExcluir: 'Excluir assembleias',
  advertenciasCriar: 'Emitir advertências',
  advertenciasExcluir: 'Excluir advertências',
  acoesAdmCriar: 'Registrar ações administrativas',
  acoesAdmExcluir: 'Excluir ações administrativas',
  reservasCancelar: 'Cancelar reservas',
};

// Agrupamento por módulo — usado pelo editor de permissões no perfil ADM.
export const GRUPOS_PERMISSOES: Array<{
  titulo: string;
  chaves: (keyof PermissoesSindico)[];
}> = [
  { titulo: 'Financeiro', chaves: ['podeVerFinanceiro'] },
  { titulo: 'Chamados', chaves: ['chamadosCriar', 'chamadosAlterarStatus', 'chamadosExcluir'] },
  { titulo: 'Avisos', chaves: ['avisosCriar', 'avisosEditar', 'avisosExcluir'] },
  { titulo: 'Enquetes', chaves: ['enquetesCriar', 'enquetesEncerrar', 'enquetesExcluir'] },
  {
    titulo: 'Assembleias',
    chaves: [
      'assembleiasCriar',
      'assembleiasRegistrarResultados',
      'assembleiasCancelar',
      'assembleiasExcluir',
    ],
  },
  { titulo: 'Advertências', chaves: ['advertenciasCriar', 'advertenciasExcluir'] },
  { titulo: 'Ações Administrativas', chaves: ['acoesAdmCriar', 'acoesAdmExcluir'] },
  { titulo: 'Reservas', chaves: ['reservasCancelar'] },
];

@Injectable()
export class PermissoesSindicoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lança ForbiddenException se o condomínio restringiu a permissão
   * pedida. Null no campo JSON = todos permitidos (comportamento anterior).
   * Chamar só quando o papel do usuário for SINDICO.
   */
  async verificar(condominioId: string, permissao: keyof PermissoesSindico): Promise<void> {
    const cond = await this.prisma.condominio.findUnique({
      where: { id: condominioId },
      select: { permissoesSindico: true },
    });
    const perms = (cond?.permissoesSindico ?? {}) as Partial<PermissoesSindico>;
    // Padrão ausente = verdadeiro (retrocompatível)
    if (perms[permissao] === false) {
      throw new ForbiddenException(
        'O administrador não habilitou esta ação para síndicos deste condomínio.',
      );
    }
  }

  obterPermissoes(raw: unknown): PermissoesSindico {
    const overrides = (raw ?? {}) as Partial<PermissoesSindico>;
    return { ...PERMISSOES_PADRAO, ...overrides };
  }
}
