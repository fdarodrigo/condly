const ACCESS_TOKEN_KEY = 'condly_access_token';

export type Papel = 'ADMINISTRADORA' | 'SINDICO' | 'CONDOMINO';

export interface VinculoToken {
  papel: Papel;
  administradoraId?: string;
  condominioId?: string;
  unidadeId?: string;
}

interface JwtPayload {
  sub: string;
  vinculos: VinculoToken[];
}

export function salvarAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function obterAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function limparAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/**
 * Decodifica só o payload do JWT (base64url), sem validar a assinatura —
 * a validação real é sempre feita pelo backend a cada requisição. Isso
 * aqui serve só pra decisão de UX (pra onde redirecionar, o que mostrar no
 * menu): nunca é usado como fonte de autorização real.
 */
export function decodificarAccessToken(token: string): JwtPayload | null {
  try {
    const payloadBase64Url = token.split('.')[1];
    if (!payloadBase64Url) return null;
    const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payloadBase64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function obterVinculos(): VinculoToken[] {
  const token = obterAccessToken();
  if (!token) return [];
  return decodificarAccessToken(token)?.vinculos ?? [];
}

export function obterUsuarioId(): string | null {
  const token = obterAccessToken();
  if (!token) return null;
  return decodificarAccessToken(token)?.sub ?? null;
}

export function temPapel(vinculos: VinculoToken[], papeis: Papel[]): boolean {
  return vinculos.some((vinculo) => papeis.includes(vinculo.papel));
}

export function obterCondominioId(vinculos: VinculoToken[]): string | undefined {
  return vinculos.find((vinculo) => vinculo.condominioId)?.condominioId;
}

export function obterAdministradoraId(vinculos: VinculoToken[]): string | undefined {
  return vinculos.find((vinculo) => vinculo.administradoraId)?.administradoraId;
}

const LABEL_PAPEL: Record<Papel, string> = {
  ADMINISTRADORA: 'Administradora',
  SINDICO: 'Síndico',
  CONDOMINO: 'Condômino',
};

/**
 * Só pra exibição (badge de papel na topbar) — o JWT não traz nome/e-mail
 * do usuário, então não há como mostrar mais do que isso sem um endpoint
 * novo. Mesma ordem de prioridade de `rotaInicialParaVinculos` quando o
 * usuário acumula mais de um papel.
 */
export function papelPrincipal(vinculos: VinculoToken[]): string | undefined {
  const ordemPrioridade: Papel[] = ['ADMINISTRADORA', 'SINDICO', 'CONDOMINO'];
  const papel = ordemPrioridade.find((p) => vinculos.some((vinculo) => vinculo.papel === p));
  return papel ? LABEL_PAPEL[papel] : undefined;
}

/**
 * Todos os três perfis caem no Dashboard; CONDOMINO vai pra própria unidade.
 * ADMINISTRADORA e SINDICO compartilham /dashboard, que mostra conteúdo
 * diferente por papel (ver DashboardRouter).
 */
export function rotaInicialParaVinculos(vinculos: VinculoToken[]): string {
  if (temPapel(vinculos, ['ADMINISTRADORA'])) return '/dashboard';
  if (temPapel(vinculos, ['SINDICO'])) return '/dashboard';
  if (temPapel(vinculos, ['CONDOMINO'])) return '/minha-unidade';
  return '/login';
}
