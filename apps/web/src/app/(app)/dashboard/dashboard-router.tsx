'use client';

import { obterVinculos, temPapel } from '@/lib/auth';
import { AdministradoraDashboardContent } from '../administradora/dashboard/administradora-dashboard-content';
import { DashboardContent } from './dashboard-content';

/**
 * Renderiza o conteúdo do Dashboard correto para o papel do usuário logado.
 * ADMINISTRADORA → visão de carteira agregada.
 * SINDICO         → visão financeira + chamados do próprio condomínio.
 */
export function DashboardRouter() {
  const vinculos = obterVinculos();
  if (temPapel(vinculos, ['ADMINISTRADORA'])) {
    return <AdministradoraDashboardContent />;
  }
  return <DashboardContent />;
}
