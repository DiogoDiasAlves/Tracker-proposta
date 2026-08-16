'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const OPCOES = [
  { valor: 'pagina', texto: 'Página de vendas' },
  { valor: 'quiz', texto: 'Quiz' },
] as const;

/* Escreve na URL — não em estado local — pelo mesmo motivo de todo filtro
   deste painel: dá pra mandar o link exato ("olha, é a aba de quiz que eu
   configurei") em vez de descrever por onde clicar. */
export function SeletorTipoInstalacao({ atual }: { atual: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  function trocar(v: string) {
    const q = new URLSearchParams(sp.toString());
    q.set('tipo', v);
    router.replace(`${path}?${q.toString()}`, { scroll: false });
  }

  return (
    <div className="pillbar">
      {OPCOES.map(o => (
        <button key={o.valor} aria-pressed={o.valor === atual} onClick={() => trocar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}
