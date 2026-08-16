'use client';

import { useState } from 'react';
import { IconClipboard, IconCopy } from '../icons';

/* Realce simples: atributo em verde, resto apagado. Sem parser — os trechos
   são curtos e um destacador de sintaxe inteiro não se paga aqui.

   Botão de copiar existe porque selecionar manualmente um bloco de código é
   fricção de sobra pra quem não é dev — e é justo essa pessoa que a Régua
   mais precisa que consiga instalar sozinha. */
export function Codigo({ children }: { children: string }) {
  const [copiado, setCopiado] = useState(false);
  const partes = children.split(/(data-[a-z-]+|<\/?[a-z][a-z0-9]*)/g);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(children);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard indisponível (http sem foco, permissão negada): segue sem travar */ }
  }

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl border border-line bg-bg p-4 pr-12 font-mono text-[12px] leading-relaxed text-muted">
        {partes.map((p, i) =>
          p.startsWith('data-')
            ? <span key={i} className="text-accent">{p}</span>
            : /^<\/?[a-z]/.test(p)
              ? <span key={i} className="text-ink">{p}</span>
              : <span key={i}>{p}</span>
        )}
      </pre>
      <button onClick={copiar} type="button"
              aria-label="Copiar código"
              className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] text-muted opacity-70 transition hover:opacity-100 hover:text-ink">
        {copiado
          ? <><IconClipboard className="h-3.5 w-3.5 text-accent" /> copiado</>
          : <IconCopy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
