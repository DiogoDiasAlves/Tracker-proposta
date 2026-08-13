import Link from 'next/link';
import { ativos, facetas, leitura, siteKey } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { Cabecalho, AindaSemColeta } from '@/components/ui/estados';
import { TEXTO, faixaQueda } from '@/lib/faixas';

export const metadata = { title: 'Páginas — Régua' };

const nf = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

export default async function Paginas() {
  const { conta } = await exigirConta();
  const lista = (await ativos(conta.id)).filter(a => a.kind === 'page' && a.sessions > 0);

  if (!lista.length) {
    return (
      <div className="max-w-4xl space-y-5">
        <Cabecalho sobre="Páginas de vendas" titulo="Nenhuma página em coleta" />
        <AindaSemColeta
          titulo="A página aparece aqui sozinha na primeira sessão"
          porque="Não há cadastro de oferta a fazer. Nomeie as seções, cole o script e rode tráfego como sempre."
          chave={await siteKey(conta.id)}
          passos={[
            { titulo: 'Nomeie os blocos', texto: <>Cada seção ganha um <span className="font-mono">data-block</span>. Você escolhe os nomes e eles aparecem assim no painel.</> },
            { titulo: 'Cole o script', texto: <>Uma linha antes do <span className="font-mono">&lt;/body&gt;</span>. Nada muda visualmente.</> },
            { titulo: 'Rode tráfego', texto: 'A coleta começa no primeiro acesso, sem configuração adicional.' },
          ]}
          exemplo={`<section data-block="hero"> ... </section>\n<script src="/r.js" data-key="SUA_CHAVE" data-page="oferta-x" defer></script>`}
        />
      </div>
    );
  }

  // Uma leitura por página para trazer o gargalo — são poucas páginas por conta,
  // e o número que importa nesta tela é justamente o pior bloco de cada uma.
  const linhas = await Promise.all(lista.map(async a => {
    const f = await facetas(conta.id, a.key);
    const maior = f.counts.reduce((x, y) => (y.n > x.n ? y : x), f.counts[0]);
    const d = await leitura(conta.id, a.key, maior?.version ?? '1', maior?.device ?? 'mobile');
    const pior = d?.steps.find(s => s.step === d.worst) ?? null;
    return { a, d, pior, recorte: maior };
  }));

  return (
    <div className="space-y-5">
      <Cabecalho
        sobre={`${lista.length} ${lista.length === 1 ? 'página' : 'páginas'} em coleta`}
        titulo="Páginas de vendas"
        descricao="O gargalo de cada página, no recorte com mais tráfego. Clique para abrir a curva completa."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {linhas.map(({ a, d, pior, recorte }) => (
          <Link key={a.key} href={`/painel/paginas/${encodeURIComponent(a.key)}`}
                className="card group p-5 transition hover:border-accent/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-mono text-[14px] text-ink">{a.key}</h2>
                <p className="mt-1 text-[11.5px] text-faint">
                  {d?.steps.length ?? 0} blocos · v{recorte?.version} · {recorte?.device}
                </p>
              </div>
              {d && !d.enough && (
                <span className="shrink-0 rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-[9.5px] uppercase tracking-wider text-danger">
                  amostra baixa
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              <Mini rotulo="sessões" valor={a.sessions.toLocaleString('pt-BR')} />
              <Mini rotulo="conversão" valor={d ? `${nf(d.conversion, 2)}%` : '—'} />
              <Mini
                rotulo="maior queda"
                valor={pior ? `${nf(pior.drop ?? 0)}%` : '—'}
                cor={pior ? TEXTO[faixaQueda(pior.drop, false)] : undefined}
              />
            </div>

            {pior && (
              <p className="mt-3 text-[12px] text-muted">
                Gargalo em <span className="text-ink">{pior.step}</span> ·{' '}
                <span style={{ color: TEXTO[faixaQueda(pior.drop, false)] }}>{pior.verdict}</span>
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Mini({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="bg-surface p-3">
      <p className="text-[9.5px] uppercase tracking-wider text-faint">{rotulo}</p>
      <p className="mt-1 text-[17px] font-semibold tnum" style={{ color: cor ?? 'var(--color-ink)' }}>
        {valor}
      </p>
    </div>
  );
}
