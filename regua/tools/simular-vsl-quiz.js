/*
 * Tráfego sintético para vídeo e quiz, para conferir as telas com volume.
 *
 *   node tools/simular-vsl-quiz.js [url] [sessoes]
 */
const URL_BASE = process.argv[2] || 'http://localhost:3100';
const N = Number(process.argv[3] || 900);
const CHAVE = process.env.REGUA_KEY || 'rg_diogo';

const DUR = 840;              // VSL de 14 minutos
const PITCH = 612;            // oferta entra aos 10:12

const rand = (a, b) => a + Math.random() * (b - a);

async function post(body, tentativa = 0) {
  const r = await fetch(URL_BASE + '/e', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'text/plain' },
  });
  if (r.status === 429) {
    if (tentativa > 12) throw new Error('limite de vazão persistente');
    await new Promise(s => setTimeout(s, 250 * (tentativa + 1)));
    return post(body, tentativa + 1);
  }
  if (!r.ok && r.status !== 204) throw new Error('ingest falhou: ' + r.status);
}

/* Curva de abandono realista: queda forte nos primeiros 30s, depois suave,
   e um degrau plantado logo antes do pitch — que é o que a tela precisa
   encontrar sozinha. */
function ateOndeAssistiu() {
  const r = Math.random();
  if (r < 0.28) return rand(0, 25);           // saíram no começo
  if (r < 0.55) return rand(25, 240);
  if (r < 0.72) return rand(240, 560);
  if (r < 0.80) return rand(560, PITCH - 10); // desistem pouco antes da oferta
  return rand(PITCH, DUR);
}

async function sessaoVideo(i, device) {
  const sid = `sv-${device}-${i}-${Math.random().toString(36).slice(2, 8)}`;
  const ate = Math.round(ateOndeAssistiu());
  const faixas = [[0, ate]];
  const revistas = [];

  // parte de quem chega na oferta volta para rever o preço
  if (ate > PITCH && Math.random() < 0.34) {
    const a = Math.round(rand(PITCH - 60, PITCH));
    revistas.push([a, Math.min(ate, a + Math.round(rand(15, 70)))]);
  }
  const parcial = Math.random() < 0.04;   // player que não expõe posição
  const converteu = ate > PITCH && Math.random() < 0.11;

  const base = { s: sid, k: CHAVE, p: 'vsl-relogio-uk', v: '1', d: device };
  const vs = [{
    i: 'vsl-principal', t: 'html5', d: DUR, p: 1 + (Math.random() < 0.12 ? 1 : 0),
    m: ate, r: parcial ? [] : faixas, rr: parcial ? [] : revistas,
    a: 1, mu: 1, pi: PITCH, pa: parcial ? 1 : 0,
  }];

  await post({ ...base, n: 1, vs,
    st: { us: 'meta', um: 'cpc', uc: 'campanha-1', uo: String(1200000 + (i % 4)), ut: null, rf: null } });
  await post({ ...base, n: 2, vs, cv: converteu ? 1 : undefined, x: { b: null, cta: 0 } });
}

const PERGUNTAS = [
  ['objetivo',  [['emagrecer', .48], ['massa', .3], ['saude', .22]]],
  ['prazo',     [['30-dias', .42], ['90-dias', .4], ['sem-pressa', .18]]],
  ['orcamento', [['ate-100', .45], ['100-300', .38], ['acima-300', .17]]],
  ['contato',   [['aceito', 1]]],
];
const OFERTA = 'resultado';

// O que o coletor leria dos botões numa página real.
const ROTULOS = {
  objetivo:  { emagrecer: 'Emagrecer', massa: 'Ganhar massa', saude: 'Mais disposição' },
  prazo:     { '30-dias': 'Em 30 dias', '90-dias': 'Em 90 dias', 'sem-pressa': 'Sem pressa' },
  orcamento: { 'ate-100': 'Até R$ 100', '100-300': 'De R$ 100 a R$ 300', 'acima-300': 'Acima de R$ 300' },
  contato:   { aceito: 'Receber meu plano' },
};

function sortear(opcoes) {
  let r = Math.random();
  for (const [chave, peso] of opcoes) { if ((r -= peso) <= 0) return chave; }
  return opcoes[0][0];
}

async function sessaoQuiz(i, device) {
  const sid = `sq-${device}-${i}-${Math.random().toString(36).slice(2, 8)}`;
  const etapas = [], respostas = [];
  let saiu = null;

  /* Parte das pessoas abre e sai sem responder nada. Sem isso a taxa de
     interação daria 100% e a métrica ficaria inútil para testar a tela. */
  const base = { s: sid, k: CHAVE, p: 'quiz-diagnostico', v: '1', d: device };
  if (Math.random() < 0.36) {
    const so = [{ i: PERGUNTAS[0][0], o: 0, h: 420, t: Math.round(rand(600, 4000)), e: 1 }];
    await post({ ...base, n: 1, qz: { e: so, rt: ROTULOS },
      st: { us: 'meta', um: 'cpc', uc: 'campanha-1', uo: String(1200000 + (i % 4)), ut: null, rf: null } });
    await post({ ...base, n: 2, qz: { e: so }, x: { b: PERGUNTAS[0][0], cta: 0 } });
    return;
  }

  for (let k = 0; k < PERGUNTAS.length; k++) {
    const [pergunta, opcoes] = PERGUNTAS[k];
    etapas.push({ i: pergunta, o: k, h: 420, t: Math.round(rand(2500, 9000)), e: 1 });
    saiu = pergunta;

    const escolha = sortear(opcoes);
    respostas.push({ q: pergunta, o: escolha, t: Date.now() });

    // orçamento é o gargalo plantado; quem escolhe "até 100" desiste mais
    let segue = 0.88;
    if (pergunta === 'orcamento') segue = escolha === 'ate-100' ? 0.46 : 0.82;
    if (pergunta === 'contato') segue = 0.71;
    if (Math.random() > segue) break;
  }

  const completou = etapas.length === PERGUNTAS.length;
  const lead = completou && Math.random() < 0.83;

  // quem virou lead vê a tela de oferta; parte clica no CTA e parte compra
  const cliques = [];
  if (lead) {
    etapas.push({ i: OFERTA, o: PERGUNTAS.length, h: 420, t: Math.round(rand(3000, 12000)), e: 1, of: 1 });
    saiu = OFERTA;
    if (Math.random() < 0.24) cliques.push({ k: 'checkout-quiz', b: OFERTA, t: Date.now() });
  }
  const converteu = cliques.length > 0 && Math.random() < 0.31;

  const qz = { e: etapas, r: respostas, rt: ROTULOS };
  if (completou) qz.c = 1;
  if (lead) qz.l = 1;

  await post({ ...base, n: 1, qz,
    st: { us: 'meta', um: 'cpc', uc: 'campanha-1', uo: String(1200000 + (i % 4)), ut: null, rf: null } });
  await post({ ...base, n: 2, qz,
    c: cliques.length ? cliques : undefined,
    cv: converteu ? 1 : undefined,
    x: { b: saiu, cta: cliques.length ? 1 : 0 } });
}

const run = async () => {
  const plano = [
    { fn: sessaoVideo, device: 'mobile', n: Math.round(N * 0.4), rotulo: 'vídeo mobile' },
    { fn: sessaoVideo, device: 'desktop', n: Math.round(N * 0.1), rotulo: 'vídeo desktop' },
    { fn: sessaoQuiz, device: 'mobile', n: Math.round(N * 0.4), rotulo: 'quiz mobile' },
    { fn: sessaoQuiz, device: 'desktop', n: Math.round(N * 0.1), rotulo: 'quiz desktop' },
  ];
  for (const p of plano) {
    for (let i = 0; i < p.n; i += 30) {
      await Promise.all(Array.from({ length: Math.min(30, p.n - i) }, (_, j) => p.fn(i + j, p.device)));
    }
    console.log(`  ${p.rotulo}: ${p.n} sessões`);
  }
  console.log('pronto.');
};

run().catch(e => { console.error(e.message); process.exit(1); });
