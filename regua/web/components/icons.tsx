/* Ícones em traço fino, 1.5px — casam com a densidade da referência.
   Feitos à mão para não carregar uma biblioteca inteira por 12 glifos. */

type P = { className?: string };
const base = 'h-[18px] w-[18px]';

function Svg({ children, className }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" className={className ?? base}>
      {children}
    </svg>
  );
}

export const IconPanel = (p: P) => (
  <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18" /></Svg>
);
export const IconLayers = (p: P) => (
  <Svg {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></Svg>
);
export const IconVideo = (p: P) => (
  <Svg {...p}><rect x="2" y="5" width="14" height="14" rx="3" /><path d="m16 12 6-3.5v11L16 16" /></Svg>
);
export const IconQuiz = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3 2.4V14" /><path d="M12 17.5h.01" /></Svg>
);
export const IconMegaphone = (p: P) => (
  <Svg {...p}><path d="M3 11v2a1 1 0 0 0 1 1h3l7 4V6L7 10H4a1 1 0 0 0-1 1Z" /><path d="M18 9a4 4 0 0 1 0 6" /></Svg>
);
export const IconCompare = (p: P) => (
  <Svg {...p}><path d="M4 20V8" /><path d="M10 20V4" /><path d="M16 20v-9" /><path d="M22 20H2" /></Svg>
);
export const IconPlug = (p: P) => (
  <Svg {...p}><path d="M9 3v6" /><path d="M15 3v6" /><path d="M7 9h10v3a5 5 0 0 1-10 0V9Z" /><path d="M12 17v4" /></Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></Svg>
);
export const IconGear = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></Svg>
);
export const IconArrowUpRight = (p: P) => (
  <Svg {...p}><path d="M7 17 17 7" /><path d="M8 7h9v9" /></Svg>
);
export const IconChevron = (p: P) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);
export const IconBolt = (p: P) => (
  <Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Svg>
);
export const IconLogo = ({ className }: P) => (
  <svg viewBox="0 0 32 32" className={className ?? 'h-8 w-8'} aria-hidden>
    <rect width="32" height="32" rx="9" fill="url(#rg)" />
    {/* a régua: marcas de medida decrescentes, que é o próprio produto */}
    <g stroke="#04241A" strokeWidth="2" strokeLinecap="round">
      <path d="M9 10h14" opacity=".95" />
      <path d="M9 16h10" opacity=".75" />
      <path d="M9 22h6" opacity=".5" />
    </g>
    <defs>
      <linearGradient id="rg" x1="0" y1="0" x2="32" y2="32">
        <stop stopColor="#8CFFD1" /><stop offset="1" stopColor="#2DF5A5" />
      </linearGradient>
    </defs>
  </svg>
);

/* Ícones dos cartões de topo, no mesmo papel que têm na referência:
   dar reconhecimento imediato à métrica antes da leitura do número. */
export const IconEye = (p: P) => (
  <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></Svg>
);
export const IconTrend = (p: P) => (
  <Svg {...p}><path d="m3 16 5-5 4 4 8-8" /><path d="M15 7h5v5" /></Svg>
);
export const IconUserCheck = (p: P) => (
  <Svg {...p}><circle cx="10" cy="8" r="3.5" /><path d="M4 20a6 6 0 0 1 10.5-4" /><path d="m16 17 2 2 4-4" /></Svg>
);
export const IconClipboard = (p: P) => (
  <Svg {...p}><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4h6v3H9z" /><path d="m9 13 2 2 4-4" /></Svg>
);
export const IconDots = (p: P) => (
  <Svg {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Svg>
);
