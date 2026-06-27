import { limparAccessToken, obterAccessToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  // POST /auth/login também responde 401 pra credencial inválida — nesse
  // caso um 401 não significa "sessão expirada", então o LoginForm pula o
  // comportamento padrão (limpar token + redirecionar) e trata a mensagem
  // de erro ele mesmo.
  ignorarRedirecionamento401?: boolean;
}

/**
 * Wrapper de fetch único pro frontend: injeta o accessToken (salvo em
 * localStorage após o login) no header Authorization de toda requisição, e
 * redireciona pra /login em qualquer resposta 401 — nenhuma página precisa
 * tratar token ausente/expirado por conta própria. Isso é só conveniência
 * de UX; a única garantia de segurança real é o RBAC do backend.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = obterAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !options.ignorarRedirecionamento401) {
    limparAccessToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
  }

  const corpo = await response.json().catch(() => null);

  if (!response.ok) {
    const mensagem =
      (corpo && typeof corpo.message === 'string' && corpo.message) ||
      `Erro ao chamar a API (HTTP ${response.status}).`;
    throw new ApiError(response.status, mensagem);
  }

  return corpo as T;
}
