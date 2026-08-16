'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CurvaPonto, PreviewVideo } from '@/lib/dados';

/* Curva de retenção do vídeo — desenhada POR CIMA do próprio vídeo, como a
   VTurb mostra na tela de analytics dela. É decoração, não codifica dado: o
   vídeo só dá contexto visual (em que trecho a curva está passando), quem
   carrega o número é a linha e o texto, exatamente como antes.

   Duas séries no mesmo eixo porque as duas são "% das sessões": quanto ainda
   assistia, e quanto estava revendo aquele trecho. A conversão acumulada NÃO
   entra aqui — ela é percentual de outra base, e sobrepor com segundo eixo é
   o erro que mais engana em gráfico. Ela vai num painel próprio.

   Aqui a curva é suave, ao contrário da página: a retenção de vídeo cai de
   fato continuamente, segundo a segundo. Degrau é que seria mentira.

   O vídeo aqui tem controle de verdade — quem opera decide quando tocar,
   pausar, arrastar — e um marcador acompanha a posição real na curva. Mesma
   técnica que o tracker já usa pra MEDIR (tracker/vsl.js): IFrame API do
   YouTube, Player.js do Vimeo, e timeupdate nativo do <video>. A diferença é
   que aqui é pra MOSTRAR, não pra gravar nada. */

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

type YTPlayer = { getCurrentTime(): number; destroy(): void };
type VimeoPlayer = {
  on(ev: string, cb: (d: { seconds: number }) => void): void;
  destroy(): Promise<void>;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: { Player: new (el: HTMLElement) => VimeoPlayer };
  }
}

const SDK_PEDIDO: Record<string, boolean> = {};
function carregarSdk(src: string, chave: string, aoCarregar: () => void) {
  if (SDK_PEDIDO[chave]) return;
  SDK_PEDIDO[chave] = true;
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onload = aoCarregar;
  document.head.appendChild(s);
}

/* Vídeo controlável de verdade — play/pausa/arrastar são do próprio player
   (YouTube, Vimeo ou o <video> nativo). Não gravamos nada aqui: só lemos a
   posição pra mover o marcador na curva. VTurb e qualquer player sem URL
   pública reaproveitável (checado em db/video.js) não chegam aqui: preview
   vem null e o fundo fica escuro liso. */
function VideoFundo({ preview, onPosicao }: {
  preview: PreviewVideo; onPosicao: (s: number | null) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (preview.tipo === 'html5') return;   // o <video> nativo reporta pelo próprio elemento
    let vivo = true;
    let intervalo: number | undefined;
    let instancia: YTPlayer | VimeoPlayer | null = null;

    function iniciarYoutube() {
      if (!vivo || !ref.current || !window.YT) return;
      const player = new window.YT.Player(ref.current, {});
      instancia = player;
      // a posição não vem por evento — perguntamos por polling, como o coletor faz
      intervalo = window.setInterval(() => {
        try { onPosicao(player.getCurrentTime()); } catch { /* player ainda não pronto */ }
      }, 250);
    }
    function iniciarVimeo() {
      if (!vivo || !ref.current || !window.Vimeo) return;
      const player = new window.Vimeo.Player(ref.current);
      instancia = player;
      player.on('timeupdate', d => onPosicao(d.seconds));
    }

    if (preview.tipo === 'youtube') {
      if (window.YT?.Player) iniciarYoutube();
      else {
        const antes = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { antes?.(); iniciarYoutube(); };
        carregarSdk('https://www.youtube.com/iframe_api', 'yt', () => {});
      }
    } else if (preview.tipo === 'vimeo') {
      if (window.Vimeo?.Player) iniciarVimeo();
      else carregarSdk('https://player.vimeo.com/api/player.js', 'vimeo', iniciarVimeo);
    }

    return () => {
      vivo = false;
      if (intervalo) window.clearInterval(intervalo);
      try { instancia?.destroy(); } catch { /* já foi */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.tipo, preview.tipo !== 'html5' ? preview.embed : null]);

  const base = 'absolute inset-0 h-full w-full';
  // O gráfico é bem mais largo que alto (860:300); vídeo é quase sempre
  // 16:9. Esticar o player pra preencher a caixa toda distorce ou corta
  // demais. Trava a proporção real e centraliza — sobra fundo escuro dos
  // lados, mas o vídeo aparece inteiro e sem deformar.
  const proporcional = 'absolute left-1/2 top-1/2 aspect-video h-full -translate-x-1/2 -translate-y-1/2';
  if (preview.tipo === 'youtube') {
    // rel=0 tira sugestão de outros canais ao pausar/terminar; iv_load_policy
    // tira anotação; disablekb tira atalho de teclado. A logo do YouTube e o
    // link "assistir no YouTube" a própria política de embed deles exige —
    // não removível sem violar os termos de uso da API.
    const q = 'enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1';
    return (
      <iframe ref={ref} src={`${preview.embed}?${q}`}
              className={proporcional} allow="autoplay; encrypted-media; picture-in-picture"
              title="prévia do vídeo" />
    );
  }
  if (preview.tipo === 'vimeo') {
    // byline/portrait/title tiram nome, foto e título de quem postou. O
    // selinho da Vimeo no canto é do plano de quem é dono do vídeo — a gente
    // não controla por aqui.
    return (
      <iframe ref={ref} src={`${preview.embed}?byline=0&portrait=0&title=0`}
              className={proporcional} allow="autoplay; encrypted-media" title="prévia do vídeo" />
    );
  }
  return (
    <video src={preview.url} className={`${base} object-contain`} controls playsInline
           onTimeUpdate={e => onPosicao(e.currentTarget.currentTime)}
           onSeeked={e => onPosicao(e.currentTarget.currentTime)} />
  );
}

export function CurvaVideo({
  curva, duracao, pitch, quedaAbrupta, preview,
}: {
  curva: CurvaPonto[];
  duracao: number;
  pitch: number | null;
  quedaAbrupta: { de: number; ate: number; queda: number } | null;
  preview: PreviewVideo | null;
}) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const [posicaoAoVivo, setPosicaoAoVivo] = useState<number | null>(null);

  const W = 860, H = 300, ml = 44, mr = 16, mt = 14, mb = 40;
  const iw = W - ml - mr, ih = H - mt - mb;
  const x = (s: number) => ml + (s / duracao) * iw;
  const y = (v: number) => mt + ih - (v / 100) * ih;

  const pontoEm = (s: number) => {
    let melhor = 0;
    for (let i = 1; i < curva.length; i++) {
      if (Math.abs(curva[i].s - s) < Math.abs(curva[melhor].s - s)) melhor = i;
    }
    return curva[melhor];
  };

  const linha = (campo: 'ret' | 'rev') =>
    curva.map((p, i) => `${i ? 'L' : 'M'}${x(p.s)},${y(p[campo])}`).join(' ');
  const area = `M${ml},${y(0)} ` + curva.map(p => `L${x(p.s)},${y(p.ret)}`).join(' ') +
               ` L${x(curva[curva.length - 1]?.s ?? 0)},${y(0)} Z`;

  const ativo = hover != null ? curva[hover] : null;
  const aoVivo = posicaoAoVivo != null && posicaoAoVivo <= duracao ? pontoEm(posicaoAoVivo) : null;
  const cartao = aoVivo ?? ativo;

  // marcas de tempo redondas, não uma por ponto
  const marcas: number[] = [];
  const passo = duracao > 900 ? 180 : duracao > 300 ? 60 : 30;
  for (let s = 0; s <= duracao; s += passo) marcas.push(s);

  // cartão em HTML, não SVG: texto de largura variável e quebra de linha são
  // triviais em CSS e um incômodo em SVG. Posicionado em % do viewBox pra
  // acompanhar o ponto ativo mesmo com o gráfico redimensionando.
  const pctX = cartao ? Math.min(88, Math.max(12, (x(cartao.s) / W) * 100)) : 0;
  const pctY = cartao ? Math.max(6, (y(cartao.ret) / H) * 100 - 4) : 0;

  return (
    <div>
      <div className="relative" style={{ aspectRatio: `${W} / ${H}` }}>
        <div className="absolute inset-0 overflow-hidden rounded-lg bg-panel">
          {/* o vídeo só ocupa até onde o gráfico termina (mt+ih) — a faixa de
              baixo (mb) fica de fora de propósito. É onde ficam os rótulos de
              tempo do SVG; se o vídeo cobrisse até a borda, os controles
              nativos dele (play/barra/tempo) desenhariam em cima desses
              rótulos e os dois ficariam ilegíveis, sobrepostos. */}
          {preview && (
            <div className="absolute inset-x-0 top-0" style={{ height: `${((mt + ih) / H) * 100}%` }}>
              <VideoFundo preview={preview} onPosicao={setPosicaoAoVivo} />
            </div>
          )}

        {/* pointer-events-none: a curva é só leitura por cima do vídeo — quem
            clica precisa alcançar o play/pausa/barra do player, não o gráfico */}
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" role="img"
             aria-label={`Retenção do vídeo ao longo de ${mmss(duracao)}. ${
               curva.filter((_, i) => i % 20 === 0).map(p => `${mmss(p.s)}: ${p.ret.toFixed(0)}%`).join('. ')}`}>
          <defs>
            <linearGradient id={`v${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={preview ? '.38' : '.24'} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* escurece o vídeo por baixo pra grade, curva e texto ficarem
              legíveis em cima de qualquer cena — sem isso um trecho claro
              do vídeo apaga o texto faint */}
          {preview && <rect x={0} y={0} width={W} height={mt + ih} fill="#000" opacity=".55" />}

          {[0, 25, 50, 75, 100].map(g => (
            <g key={g}>
              <line x1={ml} y1={y(g)} x2={W - mr} y2={y(g)}
                    stroke="var(--color-line)" opacity={g === 0 ? 1 : 0.5} />
              <text x={ml - 9} y={y(g) + 4} textAnchor="end" className="fill-faint text-[10px] tnum">{g}%</text>
            </g>
          ))}

          {/* trecho de queda abrupta: onde o roteiro quebra */}
          {quedaAbrupta && (
            <rect x={x(quedaAbrupta.de)} y={mt} width={Math.max(2, x(quedaAbrupta.ate) - x(quedaAbrupta.de))}
                  height={ih} fill="var(--color-danger)" opacity=".18" />
          )}

          <path d={area} fill={`url(#v${uid})`} />
          <path d={linha('rev')} fill="none" stroke="var(--color-mark-warn)" strokeWidth="2"
                strokeDasharray="4 3" strokeLinejoin="round" />
          <path d={linha('ret')} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />

          {/* o pitch: a métrica de manchete do vídeo */}
          {pitch != null && pitch < duracao && (
            <g>
              <line x1={x(pitch)} y1={mt} x2={x(pitch)} y2={mt + ih}
                    stroke="var(--color-ink)" strokeWidth="1.5" strokeDasharray="3 3" opacity=".65" />
              <rect x={x(pitch) - 24} y={mt - 2} width="48" height="16" rx="4" fill="var(--color-elevated)" />
              <text x={x(pitch)} y={mt + 10} textAnchor="middle" className="fill-ink text-[9px]">oferta</text>
            </g>
          )}

          {ativo && (
            <g>
              <line x1={x(ativo.s)} y1={mt} x2={x(ativo.s)} y2={mt + ih}
                    stroke="var(--color-accent)" opacity=".45" />
              <circle cx={x(ativo.s)} cy={y(ativo.ret)} r="5"
                      fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}

          {/* marcador ao vivo: onde o vídeo está agora, de verdade — distinto
              do hover (que é só exploração com o mouse) */}
          {aoVivo && (
            <g>
              <line x1={x(aoVivo.s)} y1={mt} x2={x(aoVivo.s)} y2={mt + ih}
                    stroke="var(--color-ink)" strokeWidth="2" />
              <circle cx={x(aoVivo.s)} cy={y(aoVivo.ret)} r="5.5"
                      fill="var(--color-ink)" stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}

          {marcas.map(s => (
            <text key={s} x={x(s)} y={H - 14} textAnchor="middle" className="fill-faint text-[9.5px] tnum">
              {mmss(s)}
            </text>
          ))}

          {/* O hover por mouse só existe SEM vídeo de fundo: com vídeo, quem
              explora a curva é arrastando o próprio player — e um rect por
              cima capturando clique tapa o botão de play, que é o oposto do
              que "ter controle do vídeo" pede. O marcador ao vivo já cobre
              esse papel quando há preview. */}
          {!preview && (
            <rect x={ml} y={mt} width={iw} height={ih} fill="transparent"
                  className="pointer-events-auto cursor-crosshair"
                  onMouseMove={ev => {
                    const r = ev.currentTarget.getBoundingClientRect();
                    const s = ((ev.clientX - r.left) / r.width) * W;
                    const alvo = ((s - ml) / iw) * duracao;
                    let melhor = 0;
                    for (let i = 1; i < curva.length; i++) {
                      if (Math.abs(curva[i].s - alvo) < Math.abs(curva[melhor].s - alvo)) melhor = i;
                    }
                    setHover(melhor);
                  }}
                  onMouseLeave={() => setHover(null)} />
          )}
        </svg>
        </div>

        {cartao && (
          <div className="pointer-events-none absolute z-10 w-[168px] -translate-x-1/2 rounded-lg border border-line bg-elevated/95 px-3 py-2.5 shadow-lg backdrop-blur-sm"
               style={{ left: `${pctX}%`, top: `${pctY}%`, transform: 'translate(-50%, -100%)' }}>
            <p className="text-[11px] font-medium text-ink">
              {mmss(cartao.s)} <span className="text-faint">— {cartao.ret.toFixed(0)}%</span>
            </p>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full bg-accent" /> Audiência
                </span>
                <span className="tnum font-medium text-ink">{cartao.aud.toLocaleString('pt-BR')}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full bg-accent" /> Retenção
                </span>
                <span className="tnum font-medium text-ink">{cartao.ret.toFixed(2).replace('.', ',')}%</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-accent" /> ainda assistindo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full"
                style={{ background: 'repeating-linear-gradient(90deg, var(--color-mark-warn) 0 4px, transparent 4px 7px)' }} />
          revendo o trecho
        </span>
        {preview && (
          <span className="flex items-center gap-1.5 text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" /> onde o vídeo está agora
          </span>
        )}
        {quedaAbrupta && (
          <span className="flex items-center gap-1.5 text-danger">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-danger/30" />
            maior queda: {mmss(quedaAbrupta.de)}–{mmss(quedaAbrupta.ate)}
          </span>
        )}
        <span className="ml-auto tnum text-ink">
          {preview
            ? (aoVivo ? `${mmss(aoVivo.s)} · ${aoVivo.ret.toFixed(1)}% assistindo` : 'toque em play pra navegar pela curva')
            : (ativo ? `${mmss(ativo.s)} · ${ativo.ret.toFixed(1)}% assistindo` : 'passe o mouse na curva')}
        </span>
      </div>
    </div>
  );
}
