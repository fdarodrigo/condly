export const LABEL_STATUS_CHAMADO: Record<string, string> = {
  PENDENTE_TRIAGEM: 'Pendente triagem',
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
};

export const COR_STATUS_CHAMADO: Record<string, string> = {
  PENDENTE_TRIAGEM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  ABERTO: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  EM_ANDAMENTO: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  RESOLVIDO: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

// Cor sólida só pro indicador (bolinha) ao lado de cada chamado na
// listagem — mesmo mapeamento de status de COR_STATUS_CHAMADO, mas sem
// transparência (o dot é pequeno demais pra um tom translúcido aparecer).
export const PONTO_STATUS_CHAMADO: Record<string, string> = {
  PENDENTE_TRIAGEM: 'bg-amber-400',
  ABERTO: 'bg-sky-400',
  EM_ANDAMENTO: 'bg-violet-400',
  RESOLVIDO: 'bg-emerald-400',
};

export const LABEL_STATUS_COBRANCA: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  ATRASADO: 'Atrasado',
  EM_ACORDO: 'Em acordo',
};

export const COR_STATUS_COBRANCA: Record<string, string> = {
  PENDENTE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PAGO: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  ATRASADO: 'bg-destructive/15 text-destructive border-destructive/30',
  EM_ACORDO: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

export function formatarMoeda(valor: number | string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor),
  );
}

export function formatarData(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatarHora(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
