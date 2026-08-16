import Link from 'next/link';
import { notFound } from 'next/navigation';
import { conta } from '@/lib/admin';
import { IconLayers, IconVideo, IconQuiz, IconChevron } from '@/components/icons';

export const metadata = { title: 'Conta — Admin Régua' };

const ICONE_TIPO = { page: IconLayers, vsl: IconVideo, quiz: IconQuiz } as const;

function dataCurta(iso: string | null) {
  if (!iso) return 'nunca';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function ContaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) notFound();

  const c = await conta(accountId);
  if (!c) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-[12.5px] text-faint hover:text-muted">
        <IconChevron className="h-3.5 w-3.5 rotate-90" /> Todas as contas
      </Link>

      <div>
        <h1 className="text-[19px] font-semibold tracking-tight">{c.name}</h1>
        <p className="mt-1 text-[13px] text-faint">
          @{c.slug} · cliente desde {dataCurta(c.criadaEm)}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-[12px] uppercase tracking-wider text-faint">
          Usuários ({c.usuarios.length})
        </h2>
        <div className="card divide-y divide-line p-0">
          {c.usuarios.map(u => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 text-[13px]">
              <div>
                <div className="text-ink">{u.name ?? u.email}</div>
                <div className="text-[11.5px] text-faint">{u.email}</div>
              </div>
              <span className="chip">{u.role}</span>
            </div>
          ))}
          {!c.usuarios.length && (
            <div className="px-4 py-6 text-center text-[13px] text-faint">Nenhum usuário vinculado.</div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[12px] uppercase tracking-wider text-faint">
          Páginas, VSLs e quiz em coleta ({c.ativos.length})
        </h2>
        <div className="card overflow-hidden p-0">
         <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Chave</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Sessões</th>
                <th className="px-4 py-3 font-medium">Última sessão</th>
              </tr>
            </thead>
            <tbody>
              {c.ativos.map(a => {
                const Icone = ICONE_TIPO[a.kind as keyof typeof ICONE_TIPO] ?? IconLayers;
                return (
                  <tr key={a.key} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{a.key}</td>
                    <td className="px-4 py-3 text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Icone className="h-3.5 w-3.5 text-faint" /> {a.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 tnum text-muted">{a.sessoes.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-[12px] text-faint">{dataCurta(a.ultima)}</td>
                  </tr>
                );
              })}
              {!c.ativos.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-faint">
                    Nada em coleta ainda nesta conta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
         </div>
        </div>
      </div>
    </div>
  );
}
