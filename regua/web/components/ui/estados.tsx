import Link from 'next/link';
import { Codigo } from './codigo';

export { Codigo };

export function Cabecalho({
  sobre, titulo, descricao, acao,
}: { sobre: string; titulo: string; descricao?: string; acao?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-[12px] text-faint">{sobre}</p>
        <h1 className="text-[30px] font-bold leading-none tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed text-muted">{descricao}</p>}
      </div>
      {acao}
    </header>
  );
}

/* Estado de "ainda não está coletando".

   Um painel bonito com dados de exemplo seria mais fácil de mostrar e muito
   pior de usar: a pessoa aprende a confiar num número que não existe. Aqui a
   tela diz o que falta e como resolver — e nada mais. */
export function AindaSemColeta({
  titulo, porque, passos, chave, exemplo, aviso,
}: {
  titulo: string;
  porque: string;
  passos: { titulo: string; texto: React.ReactNode }[];
  chave?: string;
  exemplo?: string;
  aviso?: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line p-6">
        <span className="chip">Nada coletado ainda</span>
        <h2 className="mt-3 text-[20px] font-semibold tracking-tight">{titulo}</h2>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-muted">{porque}</p>
      </div>

      <ol className="grid grid-cols-1 gap-px bg-line md:grid-cols-3">
        {passos.map((p, i) => (
          <li key={p.titulo} className="bg-surface p-5">
            <span className="text-[11px] font-bold tnum text-accent">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-2.5 text-[14px] font-semibold">{p.titulo}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{p.texto}</p>
          </li>
        ))}
      </ol>

      {exemplo && (
        <div className="border-t border-line p-6">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-faint">Marcação</p>
          <Codigo>{exemplo.replaceAll('SUA_CHAVE', chave ?? 'SUA_CHAVE')}</Codigo>
        </div>
      )}

      {aviso && (
        <div className="border-t border-line bg-warn/[.06] p-5 text-[12.5px] leading-relaxed text-warn">
          {aviso}
        </div>
      )}

      <div className="border-t border-line p-5">
        <Link href="/painel/instalar" className="text-[12.5px] text-accent hover:underline">
          Ver todas as instruções de instalação →
        </Link>
      </div>
    </div>
  );
}

