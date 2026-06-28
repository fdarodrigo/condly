'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { obterAccessToken } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    if (!obterAccessToken()) {
      router.replace('/login');
      return;
    }
    setAutenticado(true);
  }, [router]);

  if (!autenticado) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
