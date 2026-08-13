import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { contaAtual, ativos } from '@/lib/dados';

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const conta = await contaAtual();
  const lista = await ativos(conta.id);
  const semAmostra = lista.filter(a => a.sessions > 0 && a.sessions < 300).length;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar assets={lista} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar conta={conta.slug} avisos={semAmostra} />
        <main className="relative z-10 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
