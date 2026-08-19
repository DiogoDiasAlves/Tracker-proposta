import Link from 'next/link';
import { notFound } from 'next/navigation';
import { facetas, leitura, comparar, evolucao, mudancasEsquecidas, resumo } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { PillFiltro } from '@/components/ui/pill-filtro';
import { BotaoComConfirmacao } from '@/components/ui/confirmar-acao';
import { VistaRetencao } from '@/components/painel/vista-retencao';
import { VistaVersoes } from '@/components/painel/vista-versoes';
import { LinhaEvolucao } from '@/components/graficos/linha-evolucao';

type Props = {
  params: Promise<{ chave: string }>;
  searchParams: Promise<{ versao?: string; disp?: string; vs?: string }>;
};

export default async function PaginaDetalhe({ params, searchParams }: Props) {
  const { chave } = await params;
  const sp = await searchParams;
  const alvo = decodeURIComponent(chave);
  const { conta } = await exigirConta();

  const f = await facetas(conta.id, alvo);
  if (!f.versions.length) notFound();

  const maior = f.counts.reduce((a, b) => (b.n > a.n ? b : a), f.counts[0]);
  const versao = sp.versao && f.versions.includes(sp.versao) ? sp.versao : maior.version;
  const disp = sp.disp && f.devices.includes(sp.disp) ? sp.disp : maior.device;

  const dados = await leitura(conta.id, alvo, versao, disp);
  if (!dados || !dados.steps.length) notFound();

  // `vs` é a versão contra a qual comparar. Só entra se existir e for outra.
  const contra = sp.vs && sp.vs !== versao && f.versions.includes(sp.vs) ? sp.vs : null;
  const comp = contra ? await comparar(conta.id, alvo, versao, contra, disp) : null;

  // A linha do tempo mostra TODAS as versões juntas: é a evolução da página,
  // não de um recorte. Por isso não filtra por versão.
  const linha = (await evolucao(conta.id, alvo, disp)) ?? [];
  const esquecidas = await mudancasEsquecidas(conta.id, alvo, disp);

  // Acessos e conversão de VERDADE — soma toda versão e todo dispositivo,
  // o mesmo critério que SimilarWeb/GA usam pra "sessões" de uma página.
  // Diferente do resto desta tela, que é sempre o recorte escolhido acima.
  const total = await resumo(conta.id, alvo);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[12px] text-faint">
            <Link href="/painel/paginas" className="hover:text-muted">Páginas</Link>
            <span className="mx-1.5">/</span>
            em coleta há {dados.days} dia{dados.days > 1 ? 's' : ''}
          </p>
          <h1 className="font-mono text-[26px] font-bold leading-none tracking-tight">{dados.page}</h1>
          <p className="mt-2 text-[13px] text-muted">
            {dados.sessions.toLocaleString('pt-BR')} sessões · {dados.steps.length} blocos ·
            conversão {dados.conversion.toFixed(2).replace('.', ',')}%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PillFiltro param="versao" rotulo="Versão" valor={versao}
                      opcoes={f.versions.map(v => ({ valor: v, texto: `v${v}` }))} />
          <PillFiltro param="disp" rotulo="Dispositivo" valor={disp}
                      opcoes={f.devices.map(d => ({ valor: d, texto: d }))} />
          {f.versions.length > 1 && (
            <PillFiltro param="vs" rotulo="Comparar com" valor={contra ?? '—'}
                        opcoes={[{ valor: '', texto: '—' },
                                 ...f.versions.filter(v => v !== versao)
                                   .map(v => ({ valor: v, texto: `v${v}` }))]} />
          )}
          <div className="h-6 w-px bg-line" />
          <BotaoComConfirmacao
            titulo="Zerar métricas desta página?"
            descricao={`Apaga todas as sessões coletadas até agora de "${dados.page}" — sessões, blocos, cliques e vídeo. Não afeta nenhuma outra página da sua conta. A coleta continua normal depois, começando do zero. Essa ação não pode ser desfeita.`}
            textoConfirmar="Sim, zerar"
            formAction="/api/ativos/zerar"
            campos={{ chave: alvo }}
          >
            Zerar métricas
          </BotaoComConfirmacao>
        </div>
      </header>

      {total && (
        <section className="card grid grid-cols-4 divide-x divide-line p-0">
          <div className="p-4">
            <p className="text-[10.5px] uppercase tracking-wider text-faint">Acessos totais</p>
            <p className="mt-1 text-[22px] font-semibold tnum tracking-tight">
              {total.sessoes.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10.5px] uppercase tracking-wider text-faint">IC · Início de checkout</p>
            <p className="mt-1 text-[22px] font-semibold tnum tracking-tight">
              {total.ic.toLocaleString('pt-BR')}
            </p>
            <p className="mt-0.5 text-[11px] text-faint">
              {total.icTaxa.toFixed(2).replace('.', ',')}% das sessões
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10.5px] uppercase tracking-wider text-faint">Conversões</p>
            <p className="mt-1 text-[22px] font-semibold tnum tracking-tight">
              {total.conversoes.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10.5px] uppercase tracking-wider text-faint">Taxa de conversão</p>
            <p className="mt-1 text-[22px] font-semibold tnum tracking-tight text-accent">
              {total.conversao.toFixed(2).replace('.', ',')}%
            </p>
          </div>
          <p className="col-span-4 border-t border-line px-4 py-2 text-[11px] text-faint">
            Soma todas as versões e dispositivos — mesmo critério que SimilarWeb/GA usam pra
            contar visita. IC conta a sessão que clicou no CTA marcado como
            <span className="font-mono"> data-cta=&quot;checkout-principal&quot;</span> — uma vez por
            sessão, mesmo com vários cliques. Os números abaixo são só do recorte selecionado
            (v{versao} · {disp}).
          </p>
        </section>
      )}

      {esquecidas.length > 0 && (
        <div className="rounded-xl border border-warn/25 bg-warn/[.06] px-4 py-3.5 text-[12.5px] leading-relaxed text-warn">
          <strong className="font-semibold">A página parece ter mudado sem trocar a versão.</strong>{' '}
          {esquecidas.slice(0, 2).map(m => (
            <span key={m.dia}>
              Em {m.dia.slice(8)}/{m.dia.slice(5, 7)},{' '}
              {m.estrutura
                ? `a lista de blocos mudou (${[...m.sumiram.map(s => `saiu ${s}`), ...m.surgiram.map(s => `entrou ${s}`)].join(', ')})`
                : `a altura de ${m.alterados[0].step} variou ${Math.abs(m.alterados[0].variacao).toFixed(0)}% desde ${m.alterados[0].de.slice(8)}/${m.alterados[0].de.slice(5, 7)}`}
              , e a versão continuou v{m.versao}.{' '}
            </span>
          ))}
          Se você alterou a página, suba <span className="font-mono">data-version</span> — senão os
          dois períodos ficam somados numa versão só, e a comparação passa a medir duas páginas
          diferentes como se fossem uma.
        </div>
      )}

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[13px] uppercase tracking-wider text-muted">Evolução</h2>
          <span className="text-[11px] text-faint">
            atualiza em tempo real · a marca vertical é onde a versão trocou
          </span>
        </div>
        <LinhaEvolucao pontos={linha} />
      </section>

      {comp ? <VistaVersoes c={comp} /> : <VistaRetencao leitura={dados} />}
    </div>
  );
}
