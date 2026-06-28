'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { obterAccessToken, obterVinculos, rotaInicialParaVinculos } from '@/lib/auth';

// Raiz nunca teve conteúdo próprio (era o placeholder do Prompt 0) — só
// decide pra onde ir: /login sem token, ou a home do papel já logado.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = obterAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    router.replace(rotaInicialParaVinculos(obterVinculos()));
  }, [router]);

  return null;
}
