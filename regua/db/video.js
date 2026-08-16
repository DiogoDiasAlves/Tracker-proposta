/*
 * Métricas de vídeo.
 *
 * A curva de retenção é o produto aqui: para cada segundo, quantos por cento
 * das sessões ainda estavam assistindo. Tudo o mais qualifica essa curva.
 *
 * Duas honestidades embutidas:
 *   • sessão `parcial` (player sem posição) fica FORA da curva e é contada à
 *     parte. Somá-la ao denominador afundaria a retenção de um vídeo que
 *     talvez esteja indo bem — seria inventar abandono.
 *   • autoplay é contado separado, porque infla o play rate: quem não pediu
 *     play mesmo assim "deu play".
 */

const MAX_PONTOS = 320;   // resolução do gráfico; o dado bruto é por segundo

/** Prévia de vídeo no painel — só quando dá para montar sem hospedar nada.
 *  YouTube e Vimeo: o id já é público, vira embed oficial deles.
 *  Vídeo próprio: se a URL capturada for pública, aponta pra ela mesma.
 *  VTurb e o resto: sem prévia, só o nome — não existe URL reaproveitável. */
function previewDe(nome, tipo, url) {
  if (tipo === 'youtube') {
    const m = /^yt-(.+)$/.exec(nome);
    if (m) return { tipo: 'youtube', id: m[1], embed: `https://www.youtube.com/embed/${m[1]}`,
                     thumb: `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` };
  }
  if (tipo === 'vimeo') {
    const m = /^vimeo-(\d+)$/.exec(nome);
    if (m) return { tipo: 'vimeo', id: m[1], embed: `https://player.vimeo.com/video/${m[1]}` };
  }
  if (tipo === 'html5' && url) return { tipo: 'html5', url };
  return null;
}

/** Lista os valores de origem (utm_source, país, SO, navegador) que este
 *  asset já viu, para os filtros só aparecerem quando há mais de um valor —
 *  filtro com opção única é ruído, não controle. */
export async function origensVisitante(db, accountId, key) {
  const { rows } = await db.query(`
    SELECT s.utm_source, s.pais, s.sistema_operacional AS so, s.navegador
    FROM sessions s JOIN assets a ON a.id = s.asset_id
    WHERE a.account_id = $1 AND a.key = $2
  `, [accountId, key]);
  const uniq = f => [...new Set(rows.map(f).filter(Boolean))].sort();
  return {
    origens: uniq(r => r.utm_source),
    paises: uniq(r => r.pais),
    sos: uniq(r => r.so),
    navegadores: uniq(r => r.navegador),
  };
}

/* Filtros de origem são independentes de versão/dispositivo: entram como
   condições extras, nunca mexem na lógica que escolhe o par (versão,
   dispositivo) padrão — essa lógica já foi corrigida à dor para não abrir
   sempre no primeiro item. */
function condicoesOrigem(filtros, proximo) {
  const cond = [];
  const params = [];
  if (filtros.origem) { cond.push(`s.utm_source = $${proximo + params.length}`); params.push(filtros.origem); }
  if (filtros.pais) { cond.push(`s.pais = $${proximo + params.length}`); params.push(filtros.pais); }
  if (filtros.so) { cond.push(`s.sistema_operacional = $${proximo + params.length}`); params.push(filtros.so); }
  if (filtros.navegador) { cond.push(`s.navegador = $${proximo + params.length}`); params.push(filtros.navegador); }
  return { sql: cond.length ? ' AND ' + cond.join(' AND ') : '', params };
}

export async function metricasVideo(db, accountId, key, version, device, filtros = {}) {
  const asset = (await db.query(
    'SELECT id FROM assets WHERE account_id = $1 AND key = $2', [accountId, key]
  )).rows[0];
  if (!asset) return null;

  const origem = condicoesOrigem(filtros, 4);

  const sessoes = (await db.query(`
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE converted)::int AS conv
    FROM sessions s WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3${origem.sql}
  `, [asset.id, version, device, ...origem.params])).rows[0];
  if (!sessoes.n) return { sessoes: 0, videos: [] };

  // Cliques de CTA vividos por quem viu este ativo — "Cliques no Botão" da
  // VTurb é isto: não é o vídeo que é clicado, é o CTA que convive com ele.
  const cliques = (await db.query(`
    SELECT COUNT(*)::int AS n, COUNT(DISTINCT c.session_id)::int AS sessoes
    FROM cta_clicks c JOIN sessions s ON s.id = c.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3${origem.sql}
  `, [asset.id, version, device, ...origem.params])).rows[0];

  const linhas = (await db.query(`
    SELECT v.video, v.tipo, v.duracao, v.plays, v.max_pos, v.faixas, v.revistas,
           v.autoplay, v.mudo, v.pitch, v.parcial, v.url, s.converted
    FROM vsl_playback v JOIN sessions s ON s.id = v.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3${origem.sql}
  `, [asset.id, version, device, ...origem.params])).rows;
  if (!linhas.length) {
    return {
      sessoes: sessoes.n, conversoes: sessoes.conv,
      taxa_conversao: (sessoes.conv / sessoes.n) * 100,
      cliques_botao: cliques.n, taxa_clique: (cliques.sessoes / sessoes.n) * 100,
      videos: [],
    };
  }

  const porVideo = new Map();
  for (const l of linhas) {
    if (!porVideo.has(l.video)) porVideo.set(l.video, []);
    porVideo.get(l.video).push(l);
  }

  const videos = [];
  for (const [nome, rs] of porVideo) {
    const duracao = Math.max(...rs.map(r => r.duracao)) || 1;
    const parciais = rs.filter(r => r.parcial);
    const medidas = rs.filter(r => !r.parcial);

    // Um contador por segundo. Um VSL de 30 min são 1800 posições — barato.
    const assistindo = new Array(duracao + 1).fill(0);
    const revendo = new Array(duracao + 1).fill(0);
    const convAte = new Array(duracao + 1).fill(0);

    let somaAssistido = 0, plays = 0, autoplay = 0, mudo = 0;
    const tempos = [];

    for (const r of medidas) {
      let dessa = 0;
      for (const [a, b] of r.faixas) {
        for (let t = a; t < Math.min(b, duracao); t++) assistindo[t]++;
        dessa += Math.min(b, duracao) - a;
      }
      for (const [a, b] of r.revistas) {
        for (let t = a; t < Math.min(b, duracao); t++) revendo[t]++;
      }
      if (r.converted) convAte[Math.min(r.max_pos, duracao)]++;
      somaAssistido += dessa;
      tempos.push(dessa);
      plays += r.plays;
      if (r.autoplay) autoplay++;
      if (r.mudo) mudo++;
    }

    const base = medidas.length || 1;

    // Conversões acumuladas ao longo da linha do tempo: quanto mais fundo a
    // pessoa foi, quanto já converteu. É a métrica da VTurb que mais decide.
    let acumulado = 0;
    const convAcum = convAte.map(v => (acumulado += v));
    const totalConv = acumulado || 1;

    const passo = Math.max(1, Math.ceil(duracao / MAX_PONTOS));
    const curva = [];
    for (let t = 0; t < duracao; t += passo) {
      curva.push({
        s: t,
        ret: (assistindo[t] / base) * 100,
        rev: (revendo[t] / base) * 100,
        conv: (convAcum[t] / totalConv) * 100,
        aud: assistindo[t],   // audiência bruta: quantas sessões, não só %
      });
    }

    // Queda abrupta: a maior perda numa janela de 10s. É onde o roteiro
    // quebra — o análogo do bloco que trava na página.
    let pior = null;
    const janela = Math.max(1, Math.round(10 / passo));
    for (let i = 0; i + janela < curva.length; i++) {
      const q = curva[i].ret - curva[i + janela].ret;
      if (q > 0 && (!pior || q > pior.queda)) {
        pior = { de: curva[i].s, ate: curva[i + janela].s, queda: q };
      }
    }

    // Total bruto de plays, incluindo as sessões parciais: elas não têm
    // posição, mas o evento de play aconteceu e conta para o volume.
    const playsTotal = rs.reduce((s, r) => s + r.plays, 0);

    const pitch = rs.find(r => r.pitch != null)?.pitch ?? null;
    const retNoPitch = pitch != null && pitch < duracao
      ? (assistindo[pitch] / base) * 100 : null;

    const urlNativa = rs.find(r => r.url)?.url ?? null;

    tempos.sort((a, b) => a - b);
    const medianaAssistido = tempos.length ? tempos[Math.floor(tempos.length / 2)] : 0;

    videos.push({
      video: nome,
      tipo: rs[0].tipo,
      duracao,
      preview: previewDe(nome, rs[0].tipo, urlNativa),
      // play rate sobre TODAS as sessões da página, não só as que têm vídeo:
      // quem nunca deu play não gera linha, e ignorá-los inflaria o número
      play_rate: (rs.length / sessoes.n) * 100,
      sessoes_com_play: rs.length,
      sessoes_medidas: medidas.length,
      sessoes_parciais: parciais.length,
      plays_total: playsTotal,
      plays_por_sessao: plays / base,
      autoplay_pct: (autoplay / base) * 100,
      mudo_pct: (mudo / base) * 100,
      // fórmula da VTurb: tempo total assistido / (plays × duração)
      engajamento: plays ? (somaAssistido / (plays * duracao)) * 100 : 0,
      assistido_mediano_s: medianaAssistido,
      assistido_mediano_pct: (medianaAssistido / duracao) * 100,
      retencao_final: (assistindo[duracao - 1] / base) * 100,
      pitch,
      retencao_pitch: retNoPitch,
      queda_abrupta: pior,
      curva,
    });
  }

  videos.sort((a, b) => b.sessoes_com_play - a.sessoes_com_play);
  return {
    sessoes: sessoes.n, conversoes: sessoes.conv,
    taxa_conversao: (sessoes.conv / sessoes.n) * 100,
    cliques_botao: cliques.n, taxa_clique: (cliques.sessoes / sessoes.n) * 100,
    videos,
  };
}
