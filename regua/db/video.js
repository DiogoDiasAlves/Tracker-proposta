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

export async function metricasVideo(db, accountId, key, version, device) {
  const asset = (await db.query(
    'SELECT id FROM assets WHERE account_id = $1 AND key = $2', [accountId, key]
  )).rows[0];
  if (!asset) return null;

  const sessoes = (await db.query(`
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE converted)::int AS conv
    FROM sessions WHERE asset_id = $1 AND version = $2 AND device = $3
  `, [asset.id, version, device])).rows[0];
  if (!sessoes.n) return { sessoes: 0, videos: [] };

  const linhas = (await db.query(`
    SELECT v.video, v.tipo, v.duracao, v.plays, v.max_pos, v.faixas, v.revistas,
           v.autoplay, v.mudo, v.pitch, v.parcial, s.converted
    FROM vsl_playback v JOIN sessions s ON s.id = v.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
  `, [asset.id, version, device])).rows;
  if (!linhas.length) return { sessoes: sessoes.n, videos: [] };

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

    const pitch = rs.find(r => r.pitch != null)?.pitch ?? null;
    const retNoPitch = pitch != null && pitch < duracao
      ? (assistindo[pitch] / base) * 100 : null;

    tempos.sort((a, b) => a - b);
    const medianaAssistido = tempos.length ? tempos[Math.floor(tempos.length / 2)] : 0;

    videos.push({
      video: nome,
      tipo: rs[0].tipo,
      duracao,
      // play rate sobre TODAS as sessões da página, não só as que têm vídeo:
      // quem nunca deu play não gera linha, e ignorá-los inflaria o número
      play_rate: (rs.length / sessoes.n) * 100,
      sessoes_com_play: rs.length,
      sessoes_medidas: medidas.length,
      sessoes_parciais: parciais.length,
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
  return { sessoes: sessoes.n, conversoes: sessoes.conv, videos };
}
