'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api-client';
import { decodificarAccessToken, rotaInicialParaVinculos, salvarAccessToken } from '@/lib/auth';

interface LoginResponse {
  accessToken: string;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const { accessToken } = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, senha },
        ignorarRedirecionamento401: true,
      });
      salvarAccessToken(accessToken);
      const vinculos = decodificarAccessToken(accessToken)?.vinculos ?? [];
      router.push(rotaInicialParaVinculos(vinculos));
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível fazer login.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            data-testid="login-email"
            className="pl-8"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="senha">Senha</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            data-testid="login-senha"
            className="pl-8"
          />
        </div>
      </div>
      {erro && (
        <p role="alert" className="text-sm text-destructive" data-testid="login-erro">
          {erro}
        </p>
      )}
      <Button type="submit" disabled={enviando} data-testid="login-submit" className="mt-1 gap-1.5">
        <LogIn className="size-4" aria-hidden="true" />
        {enviando ? 'Entrando...' : 'Entrar'}
      </Button>
    </form>
  );
}
