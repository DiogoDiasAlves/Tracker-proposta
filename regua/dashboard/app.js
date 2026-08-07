/* Régua — painel. Mesma leitura visual da proposta, agora sobre dados reais. */

const NS = 'http://www.w3.org/2000/svg';
const $ = s => document.querySelector(s);
const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
const fmt = (n, d = 1) => (n === null || n === undefined || Number.isNaN(n) ? '—' : n.toFixed(d).replace('.', ','));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Escala de cor da queda — os mesmos cortes da proposta. */
function heatColor(drop, i) {
  if (i === 0 || drop === null) return 'var(--neutral)';
  if (drop < 10) return 'var(--cool)';
  if (drop < 20) return 'var(--warm)';
  return 'var(--hot)';
}
const VERDICT_COLOR = {
  TRAVA: 'var(--hot)', REJEIÇÃO: 'var(--warm)', FUNCIONA: 'var(--cool)',
  IGNORADO: 'var(--neutral)', DOBRA: 'var(--neutral)', 'ÚLTIMO': 'var(--neutral)',
};

const state = { page: null, version: null, device: 'mobile', compare: null, sel: 0, data: null };

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `HTTP ${r.status}`);
  return r.json();
}

async function boot() {
  state.pages = await api('/api/pages');
  const withData = state.pages.filter(p => p.sessions > 0);
  if (!withData.length) return renderEmpty(state.pages);

  state.page = withData[0].key;
  await loadFacets();
  await refresh();
}

async function loadFacets() {
  const f = await api('/api/facets?page=' + encodeURIComponent(state.page));
  state.facets = f;
  if (!f.versions.includes(state.version)) state.version = f.versions[0] || '1';
  if (!f.devices.includes(state.device)) state.device = f.devices[0] || 'mobile';
  if (state.compare && !f.versions.includes(state.compare)) state.compare = null;
}

async function refresh() {
  const q = new URLSearchParams({ page: state.page, version: state.version, device: state.device });
  if (state.compare) q.set('compare', state.compare);
  state.data = await api('/api/metrics?' + q);
  render();
}

function renderEmpty(pages) {
  const origin = location.origin;
  $('#root').innerHTML = `
    <div class="empty">
      <h2>Nenhum dado ainda</h2>
      <p>O painel liga sozinho assim que o primeiro visitante carregar uma página instrumentada.
         Não há cadastro de oferta a fazer: a página aparece aqui na primeira sessão.</p>
      <pre>&lt;!-- nomeie cada seção --&gt;
&lt;section <code>data-block</code>="hero"&gt; ... &lt;/section&gt;
&lt;section <code>data-block</code>="problema"&gt; ... &lt;/section&gt;
&lt;section <code>data-block</code>="oferta"&gt;
  &lt;button <code>data-cta</code>="checkout-principal"&gt;Comprar&lt;/button&gt;
&lt;/section&gt;

&lt;!-- cole antes do fechamento do body --&gt;
&lt;script src="${origin}/r.js"
        <code>data-page</code>="oferta-x"
        <code>data-version</code>="1" defer&gt;&lt;/script&gt;</pre>
      <p>Um bloco equivale a uma unidade de argumento: headline, prova social, oferta, garantia.
         De 10 a 15 por página.${pages.length ? ` Páginas conhecidas, ainda sem sessões: ${pages.map(p => esc(p.key)).join(', ')}.` : ''}</p>
      <p style="margin-top:18px">Há uma página de teste pronta em <a href="/demo/pagina-exemplo.html" style="color:var(--warm)">/demo/pagina-exemplo.html</a>.</p>
    </div>`;
}

function render() {
  const d = state.data;
  const cmp = !!state.compare;
  const main = cmp ? d.a : d;
  if (state.sel >= main.blocks.length) state.sel = 0;

  $('#root').innerHTML = `
    <div class="dash">
      <div class="toolbar">
        <select id="selPage"></select>
        <span class="tb-label">Versão</span><div class="pill" id="pillVer"></div>
        <span class="tb-label">Comparar</span><div class="pill" id="pillCmp"></div>
        <span class="tb-label">Dispositivo</span><div class="pill" id="pillDev"></div>
        <div class="tb-right">
          <span id="meta"></span>
          <span class="badge" id="badge"></span>
        </div>
      </div>
      <div class="dash-body">
        <div class="panel-a">
          <div class="panel-t"><span>Curva de retenção</span><span>% das sessões que alcançou cada bloco</span></div>
          <svg id="chart" viewBox="0 0 720 300" role="img" aria-label="Curva de retenção por bloco"></svg>
          <div class="legend" id="chartLegend"></div>
        </div>
        <div class="panel-b">
          <div class="panel-t"><span>Mapa de calor</span></div>
          <div class="heat" id="heat"></div>
          <div class="legend">
            <span><i style="background:var(--cool)"></i>até 10%</span>
            <span><i style="background:var(--warm)"></i>10–20%</span>
            <span><i style="background:var(--hot)"></i>acima de 20%</span>
            <span><i style="background:var(--neutral)"></i>dobra</span>
          </div>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Bloco</th><th>Chegaram</th><th>Queda</th><th>Tempo /100px</th>
            <th>Reentradas</th><th>Saída</th><th>CTA</th><th>CTR</th>
          </tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
      <div id="notes"></div>
      <div class="diag">
        <div>
          <div class="verdict"><b id="vLabel"></b><span class="vb" id="vBlock"></span></div>
          <p id="vText"></p>
          <div class="act" id="vAct"></div>
        </div>
        <div class="mini" id="vMini"></div>
      </div>
    </div>`;

  buildToolbar();
  renderMeta(main);
  renderChart(main);
  renderHeat(main);
  renderTable(main);
  renderNotes();
  renderDiag(main);

  $('#footNote').textContent = state.compare
    ? 'Comparação sequencial — não é teste A/B simultâneo.'
    : 'Mínimo de 300 sessões por versão. Mobile e desktop são páginas diferentes.';
}

function buildToolbar() {
  // A lista de páginas é lida uma vez no boot: render() roda a cada clique em
  // bloco e não pode disparar rede a cada vez.
  const sel = $('#selPage');
  sel.innerHTML = (state.pages || []).filter(p => p.sessions > 0)
    .map(p => `<option value="${esc(p.key)}"${p.key === state.page ? ' selected' : ''}>${esc(p.key)} · ${p.sessions} sessões</option>`).join('');
  sel.onchange = async () => {
    state.page = sel.value; state.compare = null; state.sel = 0;
    await loadFacets(); await refresh();
  };

  pills('#pillVer', state.facets.versions, state.version, v => { state.version = v; refresh(); });

  const cmpOpts = ['—', ...state.facets.versions.filter(v => v !== state.version)];
  pills('#pillCmp', cmpOpts, state.compare || '—', v => {
    state.compare = v === '—' ? null : v; refresh();
  });

  pills('#pillDev', state.facets.devices, state.device, v => { state.device = v; refresh(); });
}

function pills(sel, opts, active, on) {
  const box = $(sel);
  box.innerHTML = opts.map(o =>
    `<button data-v="${esc(o)}" aria-pressed="${o === active}">${esc(o)}</button>`).join('');
  box.onclick = e => { const b = e.target.closest('button'); if (b) on(b.dataset.v); };
}

function renderMeta(m) {
  const d = state.data;
  $('#meta').textContent = state.compare
    ? `${d.a.sessions} vs ${d.b.sessions} sessões`
    : `${m.sessions.toLocaleString('pt-BR')} sessões · ${m.days} dia${m.days > 1 ? 's' : ''} · conv. ${fmt(m.conversion)}%`;
  const enough = state.compare ? d.enough : m.enough;
  const b = $('#badge');
  b.className = 'badge ' + (enough ? 'ok' : 'low');
  b.textContent = enough ? 'amostra suficiente' : 'amostra insuficiente';
}

function renderChart(m) {
  const svg = $('#chart');
  const W = 720, H = 300, pl = 42, pr = 14, pt = 12, pb = 44;
  const iw = W - pl - pr, ih = H - pt - pb, n = m.blocks.length;
  if (!n) return;
  const sw = iw / n;
  const x = i => pl + i * sw, y = v => pt + ih - (v / 100) * ih;

  for (const g of [0, 25, 50, 75, 100]) {
    svg.appendChild(el('line', { x1: pl, y1: y(g), x2: W - pr, y2: y(g), stroke: 'var(--grid)', opacity: g === 0 ? '1' : '.55' }));
    const t = el('text', { x: pl - 9, y: y(g) + 3.5, 'text-anchor': 'end', 'font-family': 'JetBrains Mono, monospace', 'font-size': '9', fill: '#7E8DAD' });
    t.textContent = g + '%'; svg.appendChild(t);
  }

  const series = (blocks, color, dash, fill) => {
    let d = '', a = `M${pl},${y(0)}`;
    blocks.forEach((b, i) => {
      const xa = x(i), xb = x(i + 1);
      d += `${i === 0 ? 'M' : 'L'}${xa},${y(b.reach)} L${xb},${y(b.reach)}`;
      a += ` L${xa},${y(b.reach)} L${xb},${y(b.reach)}`;
    });
    a += ` L${W - pr},${y(0)} Z`;
    if (fill) svg.appendChild(el('path', { d: a, fill: color, opacity: '.12' }));
    svg.appendChild(el('path', { d, stroke: color, 'stroke-width': '2', fill: 'none', 'stroke-dasharray': dash || 'none', 'stroke-linejoin': 'round' }));
  };

  if (state.compare) {
    series(state.data.a.blocks, '#7E8DAD', '5 4', false);
    series(state.data.b.blocks, 'var(--cool)', null, true);
  } else {
    series(m.blocks, '#5FA8FF', null, true);
  }

  svg.appendChild(el('rect', { x: x(state.sel), y: pt, width: sw, height: ih, fill: '#E8A33D', opacity: '.1' }));

  m.blocks.forEach((b, i) => {
    const g = el('text', { x: x(i) + sw / 2, y: H - 26, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': '8.5', fill: i === state.sel ? '#fff' : '#7E8DAD', 'font-weight': i === state.sel ? '700' : '400' });
    g.textContent = String(i + 1); svg.appendChild(g);
    if (i === state.sel) {
      const v = el('text', { x: x(i) + sw / 2, y: H - 12, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': '8.5', fill: '#E8A33D' });
      v.textContent = b.block; svg.appendChild(v);
    }
  });

  $('#chartLegend').innerHTML = state.compare
    ? `<span><i style="background:#7E8DAD"></i>${esc(state.version)}</span><span><i style="background:#2FBF87"></i>${esc(state.compare)}</span>`
    : `<span><i style="background:#5FA8FF"></i>${esc(state.version)} · ${esc(state.device)}</span>`;
}

function renderHeat(m) {
  const box = $('#heat'); box.innerHTML = '';
  const hs = m.blocks.map(b => b.height || 1);
  const mx = Math.max(...hs), mn = Math.min(...hs);
  m.blocks.forEach((b, i) => {
    const div = document.createElement('div');
    div.className = 'heat-b'; div.tabIndex = 0;
    div.style.background = heatColor(b.drop, i);
    div.style.height = (20 + (mx > mn ? (b.height - mn) / (mx - mn) : .5) * 22) + 'px';
    if (i === state.sel) div.dataset.sel = '1';
    div.innerHTML = `<span class="hn">${esc(b.block)}</span><span class="hv">${b.drop === null ? '—' : fmt(b.drop, 0) + '%'}</span>`;
    const pick = () => { state.sel = i; render(); };
    div.onclick = pick;
    div.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
    box.appendChild(div);
  });
}

function renderTable(m) {
  const tb = $('#tbody'); tb.innerHTML = '';
  m.blocks.forEach((b, i) => {
    const tr = document.createElement('tr');
    if (i === state.sel) tr.dataset.sel = '1';
    tr.onclick = () => { state.sel = i; render(); };
    tr.innerHTML =
      `<td><span class="bidx">${i + 1}</span><span class="bname">${esc(b.block)}</span>${i === 0 ? '<span class="chip">dobra</span>' : ''}</td>` +
      `<td>${fmt(b.reach)}%</td>` +
      `<td style="font-weight:700;color:${heatColor(b.drop, i)}">${b.drop === null ? '—' : fmt(b.drop) + '%'}</td>` +
      `<td>${fmt(b.per100)}s</td>` +
      `<td>${fmt(b.entries)}</td>` +
      `<td>${fmt(b.exit)}%</td>` +
      `<td>${b.cta_clicks || '—'}</td>` +
      `<td>${b.cta_clicks ? fmt(b.cta_ctr) + '%' : '—'}</td>`;
    tb.appendChild(tr);
  });
}

function renderNotes() {
  const d = state.data, box = $('#notes');
  let html = '';

  if (state.compare) {
    const a = d.a, b = d.b, i = state.sel;
    const ba = a.blocks[i], bb = b.blocks.find(x => x.block === ba.block);
    if (bb) {
      html += `<div class="cmp-note"><b>Leitura do teste.</b> No bloco <b>${esc(ba.block)}</b>, a queda foi de
        <b>${fmt(ba.drop)}%</b> para <b>${fmt(bb.drop)}%</b>, e a conversão da página de
        <b>${fmt(a.conversion)}%</b> para <b>${fmt(b.conversion)}%</b>.
        O alcance mudou de ${fmt(ba.reach)}% para ${fmt(bb.reach)}%.
        ${d.caveat}</div>`;
    }
    if (!d.enough) {
      html += `<div class="warnbar">Uma das versões está abaixo de ${a.min_sample} sessões.
        Para detectar diferenças de 10 pontos percentuais com segurança, são necessárias cerca de 400 por versão.</div>`;
    }
    html += `<div class="warnbar">Olhe o bloco que você mexeu. Com ${a.blocks.length} blocos, é praticamente
      garantido que dois ou três vão "melhorar" ou "piorar" por acaso entre versões.</div>`;
  } else if (!d.enough) {
    html += `<div class="warnbar">Apenas ${d.sessions} sessões. Abaixo de ${d.min_sample} os números são ruído —
      leia como tendência, não como resultado.</div>`;
  }

  box.innerHTML = html;
}

function renderDiag(m) {
  const b = m.blocks[state.sel];
  if (!b) return;
  const color = VERDICT_COLOR[b.verdict] || 'var(--neutral)';

  const vl = $('#vLabel'); vl.textContent = b.verdict; vl.style.color = color;
  $('#vBlock').textContent = `bloco ${state.sel + 1} · ${b.block}`;
  $('#vText').textContent = b.reading;
  $('#vAct').textContent = b.action;

  let mini;
  if (state.compare) {
    const y = state.data.b.blocks.find(x => x.block === b.block);
    mini = `<div><span>queda ${esc(state.version)}</span><b>${b.drop === null ? '—' : fmt(b.drop) + '%'}</b></div>
      <div><span>queda ${esc(state.compare)}</span><b style="color:var(--cool)">${y && y.drop !== null ? fmt(y.drop) + '%' : '—'}</b></div>
      <div><span>tempo /100px</span><b>${fmt(b.per100)}→${y ? fmt(y.per100) : '—'}<i>s</i></b></div>
      <div><span>cliques cta</span><b>${b.cta_clicks}→${y ? y.cta_clicks : '—'}</b></div>`;
  } else {
    mini = `<div><span>chegaram</span><b>${fmt(b.reach)}<i>%</i></b></div>
      <div><span>queda</span><b style="color:${color}">${b.drop === null ? '—' : fmt(b.drop)}<i>%</i></b></div>
      <div><span>tempo mediano</span><b>${fmt(b.dwell_s)}<i>s</i></b></div>
      <div><span>reentradas</span><b>${fmt(b.entries)}</b></div>`;
  }
  $('#vMini').innerHTML = mini;
}

boot().catch(e => {
  $('#root').innerHTML = `<div class="empty"><h2>Erro</h2><p>${esc(e.message)}</p></div>`;
});
