'use client';

import { useEffect, useState } from 'react';
import { IconCheck } from '../icons';

type Resultado = { chegou: boolean; sessao: { key: string; kind: string; device: string } | null };

const NOME_TIPO: Record<string, string> = { page: 'página', vsl: 'vídeo', quiz: 'quiz' };

/* Sem isto, a única forma de saber se o script colado funcionou é navegar
   pra outra tela do painel e esperar aparecer alguma coisa — e se não
   aparecer, não dá pra saber se é porque ainda não deu tempo ou porque algo
   está errado. Aqui a resposta chega sozinha, na mesma tela onde a pessoa
   acabou de colar o código. */
export function StatusInstalacao({ desde }: { desde: string }) {
  const [r, setR] = useState<Resultado>({ chegou: false, sessao: null });

  useEffect(() => {
    let vivo = true;
    async function checar() {
      try {
        const res = await fetch(`/api/instalacao/status?desde=${encodeURIComponent(desde)}`);
        const j = (await res.json()) as Resultado;
        if (vivo) setR(j);
      } catch { /* rede momentânea: a próxima tentativa resolve sozinha */ }
    }
    checar();
    const id = setInterval(checar, 4000);
    return () => { vivo = false; clearInterval(id); };
  }, [desde]);

  if (r.chegou && r.sessao) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[.08] px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
          <IconCheck className="h-4 w-4" />
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink">
          <span className="font-semibold text-accent">Conectado.</span> Chegou uma sessão de{' '}
          <span className="font-mono">{r.sessao.key}</span> ({NOME_TIPO[r.sessao.kind] ?? r.sessao.kind},{' '}
          {r.sessao.device}) agora mesmo. O script está funcionando.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-faint/60" />
        <span className="h-2 w-2 rounded-full bg-faint" />
      </span>
      <p className="text-[12.5px] leading-relaxed text-muted">
        Aguardando a primeira sessão… Cole o script na sua página, abra ela numa aba
        e volte aqui — isto atualiza sozinho, não precisa recarregar.
      </p>
    </div>
  );
}
