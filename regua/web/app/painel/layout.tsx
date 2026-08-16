import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { ativos } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { conta, usuario } = await exigirConta();
  const lista = await ativos(conta.id);
  const baixaAmostra = lista
    .filter(a => a.sessions > 0 && a.sessions < 300)
    .map(a => ({ key: a.key, kind: a.kind, sessions: a.sessions }));

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar assets={lista} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar conta={conta.slug} usuario={usuario.name ?? usuario.email} avisos={baixaAmostra} />
        <main className="relative z-10 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
