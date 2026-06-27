'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { obterVinculos, rotaInicialParaVinculos, temPapel, type Papel } from '@/lib/auth';

/**
 * Impede um papel de navegar pra página do outro (ex: condômino abrindo
 * /dashboard direto pela URL) — redireciona pra própria home do papel.
 * Isso é só UX: a única garantia de segurança real é o RBAC do backend,
 * que rejeita a chamada de API de qualquer forma mesmo que esse guard
 * falhe ou seja contornado.
 */
export function RequireRole({ roles, children }: { roles: Papel[]; children: React.ReactNode }) {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    const vinculos = obterVinculos();
    if (!temPapel(vinculos, roles)) {
      router.replace(rotaInicialParaVinculos(vinculos));
      return;
    }
    setAutorizado(true);
  }, [router, roles]);

  if (!autorizado) return null;
  return <>{children}</>;
}
