/*
 * Gera tráfego sintético para conferir o cálculo das métricas sem esperar
 * tráfego real. Não faz parte da ferramenta — é bancada de teste.
 *
 *   node tools/simular.js [url] [sessoes]
 */

const URL_BASE = process.argv[2] || 'http://localhost:8787';
const N = Number(process.argv[3] || 1200);

const BLOCKS = [
  { id: 'hero',          h: 720,  keep: .74, dwell: 8  },
  { id: 'problema',      h: 640,  keep: .93, dwell: 14 },
  { id: 'prova-social',  h: 880,  keep: .94, dwell: 11 },
  { id: 'solucao',       h: 700,  keep: .92, dwell: 16 },
  { id: 'como-funciona', h: 960,  keep: .94, dwell: 19 },
  { id: 'beneficios',    h: 540,  keep: .93, dwell: 3  },
  { id: 'comparativo',   h: 820,  keep: .93, dwell: 12 },
  // o gargalo: leem com atenção (dwell alto) e desistem → deve sair TRAVA
  { id: 'oferta',        h: 900,  keep: .41, dwell: 41, re: 2.4 },
  { id: 'bonus',         h: 680,  keep: .91, dwell: 9  },
  { id: 'garantia',      h: 460,  keep: .92, dwell: 7  },
  { id: 'faq-cta',       h: 1040, keep: 1,   dwell: 22 },
];

const rand = (a, b) => a + Math.random() * (b - a);
const jitter = v => Math.max(1, Math.round(v * rand(.55, 1.6)));

/* Tráfego real vem de milhares de IPs; esta bancada vem de um só e bate no
   limite de vazão do servidor. Recuar e repetir é o comportamento correto —
   o limite está certo, quem está fora da curva é o simulador. */
async function post(body, tentativa = 0) {
  const r = await fetch(URL_BASE + '/e', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'text/plain' },
  });
  if (r.status === 429) {
    if (tentativa > 12) throw new Error('limite de vazão persistente');
    await new Promise(s => setTimeout(s, 250 * (tentativa + 1)));
    return post(body, tentativa + 1);
  }
  if (!r.ok && r.status !== 204) throw new Error('ingest falhou: ' + r.status + ' ' + await r.text());
}

/** `fix` aplica a correção da v2 no bloco de oferta, para a comparação de versões. */
async function session(i, version, device, fix) {
  const sid = `sim-${version}-${device}-${i}-${Math.random().toString(36).slice(2, 8)}`;
  const mobile = device === 'mobile';
  const blocks = [];
  let ctaClicks = [], converted = false, exitBlock = null, exitViaCta = false;

  for (let k = 0; k < BLOCKS.length; k++) {
    const b = BLOCKS[k];
    // desktop retém um pouco mais — comportamento real, e prova que o painel separa
    let keep = mobile ? b.keep : Math.min(1, b.keep + (b.keep < .9 ? .09 : .03));
    let dwell = b.dwell;
    let entries = b.re || rand(1, 1.35);

    if (fix && b.id === 'oferta') { keep = mobile ? .69 : .76; dwell = 26; entries = 1.6; }

    blocks.push({
      i: b.id, o: k,
      h: Math.round(b.h * (mobile ? 1 : rand(.72, .85))),
      t: jitter(dwell) * 1000,
      e: Math.random() < (entries - 1) ? 2 : 1,
    });

    if (b.id === 'oferta' && Math.random() < (fix ? .09 : .042)) {
      ctaClicks.push({ k: 'checkout-principal', b: 'oferta', t: Date.now() });
      exitViaCta = true;
      if (Math.random() < .55) converted = true;
    }
    if (k === 0 && Math.random() < .032) ctaClicks.push({ k: 'cta-hero', b: 'hero', t: Date.now() });

    exitBlock = b.id;
    if (Math.random() > keep) break;      // abandonou aqui
  }

  const base = { s: sid, p: 'oferta-relogio-uk', v: version, d: device };

  await post({ ...base, n: 1, b: blocks,
    st: { us: Math.random() < .7 ? 'meta' : 'google', um: 'cpc', uc: 'campanha-1',
          uo: Math.random() < .5 ? 'criativo-a' : 'criativo-b', ut: null, rf: null } });

  await post({ ...base, n: 2, b: blocks,
    c: ctaClicks.length ? ctaClicks : undefined,
    cv: converted ? 1 : undefined,
    x: { b: exitBlock, cta: exitViaCta ? 1 : 0 } });
}

const run = async () => {
  const plan = [
    { version: '1', device: 'mobile',  n: Math.round(N * .58), fix: false },
    { version: '1', device: 'desktop', n: Math.round(N * .13), fix: false },
    { version: '2', device: 'mobile',  n: Math.round(N * .22), fix: true  },
    { version: '2', device: 'desktop', n: Math.round(N * .07), fix: true  },
  ];

  for (const p of plan) {
    for (let i = 0; i < p.n; i += 40) {
      await Promise.all(
        Array.from({ length: Math.min(40, p.n - i) }, (_, j) => session(i + j, p.version, p.device, p.fix))
      );
    }
    console.log(`  v${p.version} ${p.device}: ${p.n} sessões`);
  }
  console.log('pronto.');
};

run().catch(e => { console.error(e.message); process.exit(1); });
