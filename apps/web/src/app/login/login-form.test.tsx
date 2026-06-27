import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';
import { limparAccessToken, obterAccessToken } from '@/lib/auth';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

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

function tokenComVinculos(vinculos: unknown[]): string {
  const payload = Buffer.from(JSON.stringify({ sub: 'usuario-1', vinculos })).toString(
    'base64url',
  );
  return `header.${payload}.assinatura`;
}

describe('LoginForm', () => {
  beforeEach(() => {
    push.mockClear();
    limparAccessToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    limparAccessToken();
  });

  it('faz login, salva o accessToken e redireciona o síndico pro dashboard', async () => {
    const usuario = userEvent.setup();
    const token = tokenComVinculos([{ papel: 'SINDICO', condominioId: 'condominio-1' }]);
    mockFetchOnce(200, { accessToken: token });

    render(<LoginForm />);
    await usuario.type(screen.getByTestId('login-email'), 'sindico@example.com');
    await usuario.type(screen.getByTestId('login-senha'), 'Senha123!');
    await usuario.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(obterAccessToken()).toBe(token);
  });

  it('redireciona o condômino pra /minha-unidade', async () => {
    const usuario = userEvent.setup();
    const token = tokenComVinculos([{ papel: 'CONDOMINO', unidadeId: 'unidade-1' }]);
    mockFetchOnce(200, { accessToken: token });

    render(<LoginForm />);
    await usuario.type(screen.getByTestId('login-email'), 'condomino@example.com');
    await usuario.type(screen.getByTestId('login-senha'), 'Senha123!');
    await usuario.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/minha-unidade'));
  });

  it('mostra a mensagem de erro da API em credenciais inválidas, sem navegar', async () => {
    const usuario = userEvent.setup();
    mockFetchOnce(401, { message: 'Credenciais inválidas.' });

    render(<LoginForm />);
    await usuario.type(screen.getByTestId('login-email'), 'sindico@example.com');
    await usuario.type(screen.getByTestId('login-senha'), 'senha-errada');
    await usuario.click(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('login-erro')).toHaveTextContent('Credenciais inválidas.');
    expect(push).not.toHaveBeenCalled();
    expect(obterAccessToken()).toBeNull();
  });
});
