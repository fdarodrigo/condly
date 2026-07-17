import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentosContent } from './documentos-content';
import { limparAccessToken, salvarAccessToken } from '@/lib/auth';

function tokenComVinculos(vinculos: unknown[]): string {
  const payload = Buffer.from(JSON.stringify({ sub: 'usuario-1', vinculos })).toString(
    'base64url',
  );
  return `header.${payload}.assinatura`;
}

function mockFetchRoteado(
  respostas: Record<string, { status: number; body?: unknown; ok?: boolean }>,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string, opcoes?: RequestInit) => {
      const chave = `${opcoes?.method ?? 'GET'} ${url}`;
      const correspondencia = Object.entries(respostas).find(([padrao]) => chave.includes(padrao));
      const resposta = correspondencia?.[1] ?? { status: 200, body: null };
      return {
        status: resposta.status,
        ok: resposta.ok ?? (resposta.status >= 200 && resposta.status < 300),
        json: async () => resposta.body ?? null,
      };
    }),
  );
}

function arquivoFalso(): File {
  return new File(['conteudo'], 'ata.pdf', { type: 'application/pdf' });
}

describe('DocumentosContent — fluxo de upload', () => {
  beforeEach(() => {
    salvarAccessToken(
      tokenComVinculos([{ papel: 'SINDICO', condominioId: 'condominio-1' }]),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    limparAccessToken();
  });

  it('envia o arquivo via POST multipart e adiciona o documento na lista', async () => {
    const usuario = userEvent.setup();
    const documentoCriado = {
      id: 'documento-1',
      tipo: 'Ata',
      visibilidade: 'TODOS',
      criadoEm: new Date().toISOString(),
    };

    mockFetchRoteado({
      'POST http://localhost:3001/condominios/condominio-1/documentos/upload': {
        status: 201,
        body: documentoCriado,
      },
      'GET http://localhost:3001/condominios/condominio-1/documentos': { status: 200, body: [] },
    });

    render(<DocumentosContent />);

    expect(await screen.findByTestId('documento-tipo')).toBeInTheDocument();

    await usuario.type(screen.getByTestId('documento-tipo'), 'Ata');
    const inputArquivo = screen.getByTestId('documento-arquivo') as HTMLInputElement;
    await usuario.upload(inputArquivo, arquivoFalso());
    await usuario.click(screen.getByTestId('documento-enviar'));

    await waitFor(() =>
      expect(screen.getByTestId('lista-documentos')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('lista-documentos')).toHaveTextContent('Ata');

    const chamadas = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const chamadaUpload = chamadas.find(([url]) => String(url).includes('/documentos/upload'));
    expect(chamadaUpload).toBeDefined();
    expect((chamadaUpload![1] as RequestInit).method).toBe('POST');
    const corpoEnviado = (chamadaUpload![1] as RequestInit).body as FormData;
    expect(corpoEnviado).toBeInstanceOf(FormData);
    expect(corpoEnviado.get('tipo')).toBe('Ata');
    expect(corpoEnviado.get('visibilidade')).toBe('TODOS');
    expect((corpoEnviado.get('arquivo') as File).name).toBe('ata.pdf');
  });

  it('rejeita o envio de um tipo de arquivo não permitido, sem chamar a API', async () => {
    const usuario = userEvent.setup();
    mockFetchRoteado({
      'GET http://localhost:3001/condominios/condominio-1/documentos': { status: 200, body: [] },
    });

    render(<DocumentosContent />);
    expect(await screen.findByTestId('documento-tipo')).toBeInTheDocument();

    await usuario.type(screen.getByTestId('documento-tipo'), 'Ata');
    const inputArquivo = screen.getByTestId('documento-arquivo') as HTMLInputElement;
    const arquivoInvalido = new File(['x'], 'ata.txt', { type: 'text/plain' });
    // userEvent.upload respeita o `accept` do input (não deixa selecionar um
    // tipo fora da lista) — fireEvent.change simula o caso em que o
    // navegador permitiu a seleção mesmo assim (`accept` é só um filtro de
    // UX, não uma garantia), pra exercitar a validação em JS que espelha
    // TIPOS_MIME_PERMITIDOS do backend.
    fireEvent.change(inputArquivo, { target: { files: [arquivoInvalido] } });
    await usuario.click(screen.getByTestId('documento-enviar'));

    expect(await screen.findByTestId('documentos-erro')).toHaveTextContent(
      'Tipo de arquivo não permitido',
    );

    const chamadas = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(chamadas.some(([url]) => String(url).includes('/documentos/upload'))).toBe(false);
  });
});
