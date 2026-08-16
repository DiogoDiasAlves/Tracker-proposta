import { PainelShell } from '@/components/shell/painel-shell';
import { ativos } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { conta, usuario } = await exigirConta();
  const lista = await ativos(conta.id);
  const baixaAmostra = lista
    .filter(a => a.sessions > 0 && a.sessions < 300)
    .map(a => ({ key: a.key, kind: a.kind, sessions: a.sessions }));

  return (
    <PainelShell
      assets={lista}
      conta={conta.slug}
      usuario={usuario.name ?? usuario.email}
      avisos={baixaAmostra}
      isAdmin={usuario.is_admin}
    >
      {children}
    </PainelShell>
  );
}
