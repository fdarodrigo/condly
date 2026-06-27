import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api-client';
import { limparAccessToken, salvarAccessToken } from './auth';

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    }),
  );
}

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injeta o Authorization com o accessToken salvo em localStorage', async () => {
    salvarAccessToken('token-de-teste');
    mockFetchOnce(200, { ok: true });

    await apiFetch('/qualquer-coisa');

    const chamada = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(chamada[1].headers.Authorization).toBe('Bearer token-de-teste');
  });

  it('não envia Authorization quando não há accessToken salvo', async () => {
    mockFetchOnce(200, { ok: true });

    await apiFetch('/qualquer-coisa');

    const chamada = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(chamada[1].headers.Authorization).toBeUndefined();
  });

  it('retorna o corpo já parseado em uma resposta 2xx', async () => {
    mockFetchOnce(200, { valor: 42 });

    const resultado = await apiFetch<{ valor: number }>('/qualquer-coisa');

    expect(resultado).toEqual({ valor: 42 });
  });

  it('em 401: limpa o accessToken, redireciona pra /login e lança ApiError', async () => {
    salvarAccessToken('token-expirado');
    mockFetchOnce(401, { message: 'Token inválido' });

    await expect(apiFetch('/qualquer-coisa')).rejects.toThrow(ApiError);

    expect(localStorage.getItem('condly_access_token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('em outro erro (ex: 403), lança ApiError com a mensagem retornada pela API', async () => {
    mockFetchOnce(403, { message: 'Você não tem permissão para acessar este recurso.' });

    await expect(apiFetch('/qualquer-coisa')).rejects.toThrow(
      'Você não tem permissão para acessar este recurso.',
    );
  });

  afterEach(() => {
    limparAccessToken();
  });
});
