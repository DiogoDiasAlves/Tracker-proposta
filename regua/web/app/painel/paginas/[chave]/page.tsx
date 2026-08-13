import Link from 'next/link';
import { notFound } from 'next/navigation';
import { facetas, leitura, comparar } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { PillFiltro } from '@/components/ui/pill-filtro';
import { VistaRetencao } from '@/components/painel/vista-retencao';
import { VistaVersoes } from '@/components/painel/vista-versoes';

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
        </div>
      </header>

      {comp ? <VistaVersoes c={comp} /> : <VistaRetencao leitura={dados} />}
    </div>
  );
}
