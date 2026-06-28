'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ExternalLink, FileText, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api-client';
import { obterVinculos, temPapel } from '@/lib/auth';
import { formatarData } from '@/lib/status-labels';

// Mesma lista de permissão de CriarUploadUrlDto.TIPOS_MIME_PERMITIDOS no
// backend — o `accept` do input é só UX, a validação real acontece lá.
const TIPOS_MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];

const LABEL_VISIBILIDADE: Record<string, string> = {
  TODOS: 'Todos',
  SINDICO_ADMINISTRADORA: 'Síndico/Administradora',
};

interface Documento {
  id: string;
  tipo: string;
  visibilidade: 'TODOS' | 'SINDICO_ADMINISTRADORA';
  criadoEm: string;
}

interface CriarUploadUrlResposta {
  uploadUrl: string;
  documento: Documento;
}

export function DocumentosContent() {
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [podeFazerUpload, setPodeFazerUpload] = useState(false);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tipo, setTipo] = useState('');
  const [visibilidade, setVisibilidade] = useState<'TODOS' | 'SINDICO_ADMINISTRADORA'>('TODOS');
  const [enviando, setEnviando] = useState(false);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const carregarDocumentos = useCallback(async (id: string) => {
    try {
      const resposta = await apiFetch<Documento[]>(`/condominios/${id}/documentos`);
      setDocumentos(resposta);
    } catch (excecao) {
      setErro(
        excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os documentos.',
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const vinculos = obterVinculos();
    setPodeFazerUpload(temPapel(vinculos, ['ADMINISTRADORA', 'SINDICO']));
    const id = vinculos.find((vinculo) => vinculo.condominioId)?.condominioId;
    if (!id) {
      setCarregando(false);
      return;
    }
    setCondominioId(id);
    void carregarDocumentos(id);
  }, [carregarDocumentos]);

  async function aoEnviarUpload(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!condominioId) return;

    const arquivo = inputArquivoRef.current?.files?.[0];
    if (!arquivo) {
      setErro('Selecione um arquivo.');
      return;
    }
    if (!TIPOS_MIME_PERMITIDOS.includes(arquivo.type)) {
      setErro('Tipo de arquivo não permitido. Use PDF, JPEG ou PNG.');
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const { uploadUrl, documento } = await apiFetch<CriarUploadUrlResposta>(
        `/condominios/${condominioId}/documentos/upload-url`,
        {
          method: 'POST',
          body: { tipo, visibilidade, nomeArquivo: arquivo.name, contentType: arquivo.type },
        },
      );

      const respostaPut = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': arquivo.type },
        body: arquivo,
      });
      if (!respostaPut.ok) {
        throw new Error('Não foi possível enviar o arquivo para o armazenamento.');
      }

      setDocumentos((atuais) => [documento, ...atuais]);
      setTipo('');
      setVisibilidade('TODOS');
      if (inputArquivoRef.current) inputArquivoRef.current.value = '';
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível enviar o documento.');
    } finally {
      setEnviando(false);
    }
  }

  async function abrirDocumento(documentoId: string) {
    setAbrindoId(documentoId);
    setErro(null);
    try {
      const { url } = await apiFetch<{ url: string }>(`/documentos/${documentoId}/download-url`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível abrir o documento.');
    } finally {
      setAbrindoId(null);
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!condominioId) {
    return (
      <p className="text-sm text-muted-foreground">
        Seu usuário não está vinculado diretamente a um condomínio específico — esta tela não se
        aplica ao seu papel.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && (
        <p role="alert" className="text-sm text-destructive" data-testid="documentos-erro">
          {erro}
        </p>
      )}

      {podeFazerUpload && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="size-4 text-muted-foreground" aria-hidden="true" />
              Enviar documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={aoEnviarUpload} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="documento-tipo">Tipo</Label>
                <Input
                  id="documento-tipo"
                  required
                  placeholder="Ex: Ata, Prestação de contas"
                  value={tipo}
                  onChange={(evento) => setTipo(evento.target.value)}
                  data-testid="documento-tipo"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="documento-visibilidade">Visibilidade</Label>
                <select
                  id="documento-visibilidade"
                  data-testid="documento-visibilidade"
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  value={visibilidade}
                  onChange={(evento) =>
                    setVisibilidade(evento.target.value as 'TODOS' | 'SINDICO_ADMINISTRADORA')
                  }
                >
                  <option value="TODOS">Todos</option>
                  <option value="SINDICO_ADMINISTRADORA">Síndico/Administradora</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="documento-arquivo">Arquivo</Label>
                <div className="rounded-lg border-2 border-dashed border-input bg-muted/30 px-3 py-3 transition-colors hover:border-primary/40">
                  <input
                    id="documento-arquivo"
                    type="file"
                    accept={TIPOS_MIME_PERMITIDOS.join(',')}
                    ref={inputArquivoRef}
                    data-testid="documento-arquivo"
                    className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
                  />
                </div>
                <span className="text-xs text-muted-foreground">PDF, JPEG ou PNG.</span>
              </div>
              <Button type="submit" disabled={enviando} data-testid="documento-enviar" className="gap-1.5">
                <UploadCloud className="size-4" aria-hidden="true" />
                {enviando ? 'Enviando…' : 'Enviar documento'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
            Documentos do condomínio
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento disponível.</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-documentos">
              {documentos.map((documento) => (
                <li
                  key={documento.id}
                  data-testid="documento-item"
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="size-4" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{documento.tipo}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatarData(documento.criadoEm)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{LABEL_VISIBILIDADE[documento.visibilidade]}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={abrindoId === documento.id}
                      onClick={() => abrirDocumento(documento.id)}
                      data-testid="documento-abrir"
                      className="gap-1"
                    >
                      {abrindoId === documento.id ? (
                        'Abrindo…'
                      ) : (
                        <>
                          Abrir
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
