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

export function temPapel(vinculos: VinculoToken[], papeis: Papel[]): boolean {
  return vinculos.some((vinculo) => papeis.includes(vinculo.papel));
}

export function obterCondominioId(vinculos: VinculoToken[]): string | undefined {
  return vinculos.find((vinculo) => vinculo.condominioId)?.condominioId;
}

/**
 * SINDICO/ADMINISTRADORA caem no dashboard do condomínio; CONDOMINO cai na
 * própria unidade. Decisão do Prompt 10.5 — se um usuário tiver mais de um
 * papel (caso raro), síndico/administradora prevalece sobre condômino.
 */
export function rotaInicialParaVinculos(vinculos: VinculoToken[]): string {
  if (temPapel(vinculos, ['SINDICO', 'ADMINISTRADORA'])) return '/dashboard';
  if (temPapel(vinculos, ['CONDOMINO'])) return '/minha-unidade';
  return '/login';
}
