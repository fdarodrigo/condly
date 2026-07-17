'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../api-client';
import { obterAdministradoraId, obterCondominioId, obterVinculos } from '../auth';

export interface CondominioItem {
  id: string;
  nome: string;
}

export interface UseCondominioAtivoResult {
  condominioId: string | null;
  /** Lista de condomínios disponíveis — não vazia só para ADMINISTRADORA com
   *  mais de um condomínio na carteira; nos outros casos é sempre `[]`. */
  condominios: CondominioItem[];
  selecionarCondominio: (id: string) => void;
  carregando: boolean;
  erro: string | null;
}

/**
 * Resolve o condominioId ativo para qualquer papel:
 * - SINDICO / CONDOMINO: lê direto dos vínculos do JWT (já vem resolvido no login).
 * - ADMINISTRADORA: busca a lista de condomínios da carteira via API e
 *   pré-seleciona o primeiro; expõe `condominios` para renderizar um seletor
 *   quando houver mais de um.
 */
export function useCondominioAtivo(): UseCondominioAtivoResult {
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [condominios, setCondominios] = useState<CondominioItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const vinculos = obterVinculos();
    const id = obterCondominioId(vinculos);

    if (id) {
      setCondominioId(id);
      setCarregando(false);
      return;
    }

    const administradoraId = obterAdministradoraId(vinculos);
    if (!administradoraId) {
      setCarregando(false);
      return;
    }

    apiFetch<CondominioItem[]>(`/administradoras/${administradoraId}/condominios`)
      .then((lista) => {
        setCondominios(lista);
        if (lista.length > 0) setCondominioId(lista[0].id);
      })
      .catch((e) => {
        setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar os condomínios.');
      })
      .finally(() => setCarregando(false));
  }, []);

  return { condominioId, condominios, selecionarCondominio: setCondominioId, carregando, erro };
}
