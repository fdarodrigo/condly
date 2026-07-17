'use client';

import { useEffect, useState } from 'react';
import { obterVinculos, temPapel } from '@/lib/auth';
import { apiFetch } from '@/lib/api-client';

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

/** ADM e outros papéis sem restrições individuais recebem todas as permissões. */
const TUDO_PERMITIDO: PermissoesSindico = {
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

interface CondominioComPermissoes {
  permissoesSindico: PermissoesSindico | null;
}

/**
 * Carrega as permissões do síndico para o condomínio vinculado.
 * - Para ADMINISTRADORA e CONDOMINO: retorna tudo permitido (sem restrições).
 * - Para SINDICO: busca `GET /condominios/:id` e lê `permissoesSindico`.
 *   Qualquer chave ausente é tratada como `true` (retrocompatível com a versão antiga).
 * - Durante carregamento: retorna `TUDO_PERMITIDO` para não bloquear UI.
 */
export function usePermissoesSindico(): { permissoes: PermissoesSindico; carregando: boolean } {
  const [permissoes, setPermissoes] = useState<PermissoesSindico>(TUDO_PERMITIDO);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const vinculos = obterVinculos();

    if (!temPapel(vinculos, ['SINDICO'])) {
      // ADM, CONDOMINO e outros: sem restrições de permissão de síndico.
      setPermissoes(TUDO_PERMITIDO);
      setCarregando(false);
      return;
    }

    const condominioId = vinculos.find((v) => v.condominioId && v.papel === 'SINDICO')
      ?.condominioId;

    if (!condominioId) {
      setCarregando(false);
      return;
    }

    apiFetch<CondominioComPermissoes>(`/condominios/${condominioId}`)
      .then((data) => {
        const raw = data.permissoesSindico ?? {};
        // Mescla com padrão: chaves ausentes no banco = true (retrocompatível).
        setPermissoes({ ...TUDO_PERMITIDO, ...raw });
      })
      .catch(() => {
        // Fallback conservador: não bloquear UI se a busca falhar.
        setPermissoes(TUDO_PERMITIDO);
      })
      .finally(() => setCarregando(false));
  }, []);

  return { permissoes, carregando };
}
