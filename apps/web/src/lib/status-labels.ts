export const LABEL_STATUS_CHAMADO: Record<string, string> = {
  PENDENTE_TRIAGEM: 'Pendente triagem',
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
};

export const COR_STATUS_CHAMADO: Record<string, string> = {
  PENDENTE_TRIAGEM: 'bg-amber-100 text-amber-800 border-amber-200',
  ABERTO: 'bg-blue-100 text-blue-800 border-blue-200',
  EM_ANDAMENTO: 'bg-violet-100 text-violet-800 border-violet-200',
  RESOLVIDO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const LABEL_STATUS_COBRANCA: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  ATRASADO: 'Atrasado',
  EM_ACORDO: 'Em acordo',
};

export const COR_STATUS_COBRANCA: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800 border-amber-200',
  PAGO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ATRASADO: 'bg-red-100 text-red-800 border-red-200',
  EM_ACORDO: 'bg-blue-100 text-blue-800 border-blue-200',
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
