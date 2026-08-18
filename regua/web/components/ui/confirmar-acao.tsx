'use client';

import { useRef, useState } from 'react';

/* Ação destrutiva com aviso antes de executar. Sem lib de modal — é um
   overlay simples que só existe pra segurar o clique um instante e mostrar
   o que vai acontecer; o disparo em si continua sendo o mesmo <form method
   post> usado em toda mutação do app (POST/Redirect/GET, sem JS no caminho
   crítico), só que submetido por script depois da confirmação. */
export function BotaoComConfirmacao({
  children, titulo, descricao, textoConfirmar = 'Confirmar', className, formAction, campos = {},
}: {
  children: React.ReactNode; titulo: string; descricao: string; textoConfirmar?: string;
  className?: string; formAction: string; campos?: Record<string, string>;
}) {
  const [aberto, setAberto] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={className ?? 'btn-ghost px-3.5 py-2 text-[12.5px] text-danger'}
      >
        {children}
      </button>

      <form ref={formRef} action={formAction} method="post" className="hidden">
        {Object.entries(campos).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      </form>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(4,10,8,.75)] px-4"
          onClick={() => setAberto(false)}
        >
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold">{titulo}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{descricao}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="btn-ghost px-3.5 py-2 text-[12.5px] text-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => formRef.current?.requestSubmit()}
                className="rounded-xl bg-danger px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110"
              >
                {textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
