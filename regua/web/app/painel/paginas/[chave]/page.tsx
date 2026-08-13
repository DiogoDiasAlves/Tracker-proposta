import Link from 'next/link';
import { notFound } from 'next/navigation';
import { facetas, leitura } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { PillFiltro } from '@/components/ui/pill-filtro';
import { VistaRetencao } from '@/components/painel/vista-retencao';

type Props = {
  params: Promise<{ chave: string }>;
  searchParams: Promise<{ versao?: string; disp?: string }>;
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
            <Link href={`/painel/comparar?pagina=${encodeURIComponent(alvo)}`}
                  className="btn-ghost px-3.5 py-2.5 text-[12.5px]">
              Comparar versões
            </Link>
          )}
        </div>
      </header>

      <VistaRetencao leitura={dados} />
    </div>
  );
}
