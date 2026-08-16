import Link from 'next/link';
import { contas, resumo } from '@/lib/admin';
import { IconUser, IconLayers, IconVideo, IconQuiz, IconMegaphone } from '@/components/icons';

export const metadata = { title: 'Admin — Régua' };

function tempoAtras(iso: string | null) {
  if (!iso) return 'sem atividade';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export default async function AdminPage() {
  const [lista, geral] = await Promise.all([contas(), resumo()]);

  const cards = [
    { rotulo: 'Contas', valor: geral.contas, Icon: IconUser },
    { rotulo: 'Ativas nos últimos 7 dias', valor: geral.contasAtivas7d, Icon: IconLayers },
    { rotulo: 'Sessões (total)', valor: geral.sessoes, Icon: IconVideo },
    { rotulo: 'Sessões (7 dias)', valor: geral.sessoes7d, Icon: IconQuiz },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[19px] font-semibold tracking-tight">Contas na plataforma</h1>
        <p className="mt-1 text-[13px] text-faint">
          Uso por cliente — páginas, VSLs e quiz em coleta, e quando cada um usou por último.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ rotulo, valor, Icon }) => (
          <div key={rotulo} className="card p-4">
            <div className="flex items-center gap-2 text-[11.5px] text-faint">
              <Icon className="h-4 w-4" />
              {rotulo}
            </div>
            <div className="mt-2 text-[24px] font-semibold tnum tracking-tight">
              {valor.toLocaleString('pt-BR')}
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
       <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
              <th className="px-4 py-3 font-medium">Conta</th>
              <th className="px-4 py-3 font-medium">Usuários</th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1"><IconLayers className="h-3.5 w-3.5" /> Páginas</span>
              </th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1"><IconVideo className="h-3.5 w-3.5" /> VSL</span>
              </th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1"><IconQuiz className="h-3.5 w-3.5" /> Quiz</span>
              </th>
              <th className="px-4 py-3 font-medium">Sessões</th>
              <th className="px-4 py-3 font-medium">7 dias</th>
              <th className="px-4 py-3 font-medium">Meta</th>
              <th className="px-4 py-3 font-medium">Última atividade</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(c => (
              <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-surface/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/contas/${c.id}`} className="font-medium text-ink hover:text-accent">
                    {c.name}
                  </Link>
                  <div className="text-[11px] text-faint">@{c.slug}</div>
                </td>
                <td className="px-4 py-3 tnum text-muted">{c.usuarios}</td>
                <td className="px-4 py-3 tnum text-muted">{c.paginas}</td>
                <td className="px-4 py-3 tnum text-muted">{c.vsls}</td>
                <td className="px-4 py-3 tnum text-muted">{c.quizzes}</td>
                <td className="px-4 py-3 tnum text-muted">{c.sessoes.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 tnum text-muted">{c.sessoes7d.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3">
                  {c.metaConectada ? (
                    <span className="chip inline-flex items-center gap-1 text-accent">
                      <IconMegaphone className="h-3 w-3" /> conectada
                    </span>
                  ) : (
                    <span className="text-[12px] text-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[12px] text-faint">{tempoAtras(c.ultimaAtividade)}</td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[13px] text-faint">
                  Nenhuma conta cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
       </div>
      </div>
    </div>
  );
}
