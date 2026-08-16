'use client';

import { useEffect, useState } from 'react';
import { IconBolt } from '../icons';

type Passo = { alvo: string | null; titulo: string; texto: string };

const PASSOS: Passo[] = [
  {
    alvo: null,
    titulo: 'Bem-vindo à Régua',
    texto: 'Vamos te mostrar em menos de um minuto como instalar o script e começar a coletar dados. Você pode pular a qualquer momento.',
  },
  {
    alvo: 'tour-status',
    titulo: 'Confirmação ao vivo',
    texto: 'Assim que colar o script na sua página e alguém abrir ela, este indicador muda sozinho — sem precisar recarregar nada pra saber se funcionou.',
  },
  {
    alvo: 'tour-chave',
    titulo: 'Sua chave',
    texto: 'Essa chave é pública e vai dentro do script. Ela só diz de qual conta é o evento que está chegando — não dá acesso a nada sozinha.',
  },
  {
    alvo: 'tour-tipo',
    titulo: 'Página ou quiz?',
    texto: 'Escolha o que você está instalando agora. O texto abaixo muda de acordo — dá pra voltar aqui e trocar quando quiser.',
  },
  {
    alvo: 'tour-ia',
    titulo: 'O caminho mais rápido',
    texto: 'Se você desenvolve com ajuda de IA, copie este texto e cole direto nela — ela lê sua página e instala tudo sozinha. Os passos manuais continuam logo abaixo, pra quem preferir fazer à mão.',
  },
];

function posicaoAlvo(alvo: string | null) {
  if (!alvo) return null;
  const el = document.getElementById(alvo);
  if (!el) return null;
  return el.getBoundingClientRect();
}

export function TourInstalacao() {
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [visivel, setVisivel] = useState(true);

  const passo = PASSOS[indice];
  const ultimo = indice === PASSOS.length - 1;

  useEffect(() => {
    if (!visivel) return;
    const el = passo.alvo ? document.getElementById(passo.alvo) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const atualizar = () => setRect(posicaoAlvo(passo.alvo));
    atualizar();
    const t = window.setTimeout(atualizar, 350);
    window.addEventListener('resize', atualizar);
    window.addEventListener('scroll', atualizar, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', atualizar);
      window.removeEventListener('scroll', atualizar, true);
    };
  }, [indice, passo.alvo, visivel]);

  async function encerrar() {
    setVisivel(false);
    try {
      await fetch('/api/tour/concluir', { method: 'POST' });
    } catch {
      // sem sorte agora, o tour só aparece de novo — não é grave
    }
  }

  if (!visivel) return null;

  const largura = 340;
  const alturaEstimada = 220;
  const margem = 16;
  const estiloCartao = rect
    ? {
        top: window.innerHeight - rect.bottom > alturaEstimada + margem
          ? rect.bottom + margem
          : Math.max(margem, rect.top - alturaEstimada - margem),
        left: Math.min(Math.max(margem, rect.left), window.innerWidth - largura - margem),
      }
    : null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {rect ? (
        <div
          className="pointer-events-none fixed z-[101] rounded-xl ring-2 ring-accent transition-all duration-300"
          style={{
            top: rect.top - 8, left: rect.left - 8,
            width: rect.width + 16, height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(4,10,8,.8)',
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[101] bg-[rgba(4,10,8,.8)]" />
      )}

      <div
        className="card fixed z-[102] p-5 shadow-2xl transition-all duration-300"
        style={
          estiloCartao
            ? { top: estiloCartao.top, left: estiloCartao.left, width: largura }
            : { top: '50%', left: '50%', width: largura, transform: 'translate(-50%,-50%)' }
        }
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint">
            <IconBolt className="h-3.5 w-3.5 text-accent" />
            Passo {indice + 1} de {PASSOS.length}
          </span>
          <button onClick={encerrar} className="text-[11.5px] text-faint hover:text-muted">
            Pular tour
          </button>
        </div>

        <h3 className="text-[15px] font-semibold">{passo.titulo}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{passo.texto}</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          {indice > 0 && (
            <button
              onClick={() => setIndice(i => i - 1)}
              className="btn-ghost px-3.5 py-2 text-[12.5px] text-muted"
            >
              Voltar
            </button>
          )}
          <button
            onClick={() => (ultimo ? encerrar() : setIndice(i => i + 1))}
            className="btn-accent px-4 py-2 text-[12.5px]"
          >
            {ultimo ? 'Entendi, vou instalar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
