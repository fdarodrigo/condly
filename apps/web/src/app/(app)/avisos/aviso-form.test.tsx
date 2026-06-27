import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvisoForm } from './aviso-form';

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

describe('AvisoForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia título, corpo e os canais marcados, sem unidadeId quando o escopo é condomínio inteiro', async () => {
    const usuario = userEvent.setup();
    mockFetchOnce(201, { id: 'aviso-1' });
    const onCriado = vi.fn();

    render(<AvisoForm condominioId="condominio-1" onCriado={onCriado} />);
    await usuario.type(screen.getByTestId('aviso-titulo'), 'Assembleia geral');
    await usuario.type(screen.getByTestId('aviso-corpo'), 'Assembleia no salão de festas.');
    await usuario.click(screen.getByTestId('aviso-canal-email'));
    await usuario.click(screen.getByTestId('aviso-submit'));

    await waitFor(() => expect(onCriado).toHaveBeenCalled());

    const chamada = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(chamada[0]).toBe('http://localhost:3001/condominios/condominio-1/avisos');
    const corpoEnviado = JSON.parse(chamada[1].body);
    expect(corpoEnviado).toEqual({
      titulo: 'Assembleia geral',
      corpo: 'Assembleia no salão de festas.',
      canais: ['APP', 'EMAIL'],
    });
    expect(corpoEnviado.unidadeId).toBeUndefined();
    expect(await screen.findByTestId('aviso-form-mensagem')).toHaveTextContent('Aviso enviado!');
  });

  it('inclui unidadeId no corpo quando o escopo é unidade específica', async () => {
    const usuario = userEvent.setup();
    mockFetchOnce(201, { id: 'aviso-1' });

    render(<AvisoForm condominioId="condominio-1" />);
    await usuario.type(screen.getByTestId('aviso-titulo'), 'Encomenda na portaria');
    await usuario.type(screen.getByTestId('aviso-corpo'), 'Sua encomenda chegou.');
    await usuario.click(screen.getByTestId('aviso-escopo-unidade'));
    await usuario.type(screen.getByTestId('aviso-unidade-id'), 'unidade-42');
    await usuario.click(screen.getByTestId('aviso-submit'));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const chamada = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const corpoEnviado = JSON.parse(chamada[1].body);
    expect(corpoEnviado.unidadeId).toBe('unidade-42');
  });

  it('rejeita o envio sem nenhum canal selecionado, sem chamar a API', async () => {
    const usuario = userEvent.setup();
    mockFetchOnce(201, { id: 'aviso-1' });

    render(<AvisoForm condominioId="condominio-1" />);
    await usuario.type(screen.getByTestId('aviso-titulo'), 'Título');
    await usuario.type(screen.getByTestId('aviso-corpo'), 'Corpo');
    await usuario.click(screen.getByTestId('aviso-canal-app'));
    await usuario.click(screen.getByTestId('aviso-submit'));

    expect(await screen.findByTestId('aviso-form-erro')).toHaveTextContent(
      'Selecione ao menos um canal.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
