'use client';

import { useState } from 'react';
import { Sidebar, type AssetResumo } from './sidebar';
import { Topbar } from './topbar';
import type { ItemAviso } from './avisos-amostra';

export function PainelShell({
  assets, conta, usuario, avisos, isAdmin, children,
}: {
  assets: AssetResumo[]; conta: string; usuario?: string; avisos?: ItemAviso[];
  isAdmin?: boolean; children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(false);

  // Fecha ao navegar: cada link do drawer (Sidebar) já chama onFechar no
  // clique — não precisa de efeito ouvindo a rota pra isso.
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar assets={assets} aberta={aberta} onFechar={() => setAberta(false)} />

      {aberta && (
        <div
          onClick={() => setAberta(false)}
          className="fixed inset-0 z-20 bg-[rgba(4,10,8,.7)] md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar conta={conta} usuario={usuario} avisos={avisos} isAdmin={isAdmin} onMenu={() => setAberta(true)} />
        <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
