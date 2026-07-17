'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ExternalLink, FileText, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api-client';
import { temPapel, obterVinculos } from '@/lib/auth';
import { useCondominioAtivo } from '@/lib/hooks/use-condominio-ativo';
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


function CondominioSelector({
  condominios,
  valor,
  onChange,
}: {
  condominios: { id: string; nome: string }[];
  valor: string;
  onChange: (id: string) => void;
}) {
  if (condominios.length <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="documentos-condominio">Condomínio</Label>
      <select
        id="documentos-condominio"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {condominios.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DocumentosContent() {
  const {
    condominioId,
    condominios,
    selecionarCondominio,
    carregando: carregandoCondominio,
    erro: erroCondominio,
  } = useCondominioAtivo();

  const [podeFazerUpload] = useState(() =>
    temPapel(obterVinculos(), ['ADMINISTRADORA', 'SINDICO']),
  );
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tipo, setTipo] = useState('');
  const [visibilidade, setVisibilidade] = useState<'TODOS' | 'SINDICO_ADMINISTRADORA'>('TODOS');
  const [enviando, setEnviando] = useState(false);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const carregarDocumentos = useCallback(async (id: string) => {
    setCarregando(true);
    setErro(null);
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
    if (!condominioId) return;
    void carregarDocumentos(condominioId);
  }, [condominioId, carregarDocumentos]);

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
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('tipo', tipo);
      formData.append('visibilidade', visibilidade);

      const documento = await apiFetch<Documento>(
        `/condominios/${condominioId}/documentos/upload`,
        { method: 'POST', formData },
      );

      setDocumentos((atuais) => [documento, ...atuais]);
      setTipo('');
      setVisibilidade('TODOS');
      if (inputArquivoRef.current) inputArquivoRef.current.value = '';
    } catch (excecao) {
      setErro(
        excecao instanceof ApiError ? excecao.message : 'Não foi possível enviar o documento.',
      );
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
      setErro(
        excecao instanceof ApiError ? excecao.message : 'Não foi possível abrir o documento.',
      );
    } finally {
      setAbrindoId(null);
    }
  }

  if (carregandoCondominio) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (erroCondominio) {
    return <p className="text-sm text-destructive">{erroCondominio}</p>;
  }

  if (!condominioId) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum condomínio encontrado na carteira.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CondominioSelector
        condominios={condominios}
        valor={condominioId}
        onChange={selecionarCondominio}
      />

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
              <Button
                type="submit"
                disabled={enviando}
                data-testid="documento-enviar"
                className="gap-1.5"
              >
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
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : documentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento disponível.</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-documentos">
              {documentos.map((documento) => (
                <li
                  key={documento.id}
                  data-testid="documento-item"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/3"
                >
                  <div className="flex min-w-0 items-center gap-3">
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
