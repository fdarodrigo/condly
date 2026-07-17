/**
 * Dados simulados para métricas ainda sem backend no dashboard da administradora.
 * Identificadas na UI com o badge "Dados simulados" — nenhuma decisão de negócio
 * deve ser tomada com base nesses valores.
 *
 * Módulos que precisarão de backend real para substituir este arquivo:
 *  - Satisfação: pesquisas de NPS/CSAT por condomínio (modelo ainda não existe)
 *  - Balanços: categorias de despesa operacional (modelo de despesas ainda não existe)
 */

export interface SatisfacaoCondominio {
  condominioId: string;
  nome: string;
  nps: number; // 0–10
  respondentes: number;
}

export interface BalancoCondominio {
  condominioId: string;
  nome: string;
  receita: number;
  despesa: number;
  saldo: number;
}

// Hash determinístico: mesmo condominioId sempre gera os mesmos valores —
// evita que o mock "flicker" ao re-renderizar, sem precisar de estado extra.
function seed(id: string): number {
  return id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

/**
 * Gera scores de satisfação (NPS 0–10) simulados para cada condomínio.
 * Retorna ordenado do mais satisfeito para o menos.
 */
export function gerarSatisfacaoMock(
  condominios: { condominioId: string; nome: string }[],
): SatisfacaoCondominio[] {
  return condominios
    .map((c) => {
      const s = seed(c.condominioId);
      // NPS entre 4,0 e 9,5 com uma casa decimal
      const nps = Math.round((4 + (s % 56) / 10) * 10) / 10;
      return {
        condominioId: c.condominioId,
        nome: c.nome,
        nps,
        respondentes: 8 + (s % 42),
      };
    })
    .sort((a, b) => b.nps - a.nps);
}

/**
 * Gera balanços simulados (receita real da API + despesa estimada).
 * `receitaReal` é o `totalRecebidoNoMes` vindo do dashboard — usar receita
 * real como base torna o balanço visualmente coerente com os outros cards.
 */
export function gerarBalancoMock(
  condominios: { condominioId: string; nome: string; receitaReal: number }[],
): BalancoCondominio[] {
  return condominios.map((c) => {
    const s = seed(c.condominioId);
    // Despesa entre 52 % e 88 % da receita, variando por condomínio
    const pctDespesa = (52 + (s % 36)) / 100;
    // Quando não há receita real, usa um valor base simulado
    const receita = c.receitaReal > 0 ? c.receitaReal : 4000 + (s % 8000);
    const despesa = Math.round(receita * pctDespesa);
    return {
      condominioId: c.condominioId,
      nome: c.nome,
      receita,
      despesa,
      saldo: receita - despesa,
    };
  });
}
