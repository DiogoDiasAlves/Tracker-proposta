'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/* Filtros ficam numa linha só acima dos gráficos e escrevem na URL.
   Escrever na URL não é detalhe: é o que deixa você mandar "olha o bloco 8
   da v2 no mobile" por mensagem e a pessoa abrir exatamente a mesma tela. */
export function PillFiltro({
  param, opcoes, valor, rotulo,
}: { param: string; opcoes: { valor: string; texto: string }[]; valor: string; rotulo?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  function trocar(v: string) {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(param, v); else q.delete(param);
    router.replace(`${path}?${q.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      {rotulo && <span className="text-[11px] uppercase tracking-wider text-faint">{rotulo}</span>}
      <div className="pillbar">
        {opcoes.map(o => (
          <button key={o.valor} aria-pressed={o.valor === valor} onClick={() => trocar(o.valor)}>
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
