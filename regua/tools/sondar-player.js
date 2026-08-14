/*
 * Sonda um player desconhecido numa página real.
 *
 * A pergunta é sempre a mesma: dá para saber EM QUE SEGUNDO o vídeo está?
 * Sem isso não existe curva de retenção, só play e pausa. Este script tenta
 * todos os caminhos plausíveis e relata qual respondeu — em vez de assumir.
 *
 *   node tools/sondar-player.js <url>
 */
import { chromium } from 'playwright';

const URL_ALVO = process.argv[2];
if (!URL_ALVO) { console.error('uso: node tools/sondar-player.js <url>'); process.exit(1); }

const b = await chromium.launch({
  channel: 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const p = await b.newPage({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

console.log(`\nsondando ${URL_ALVO}\n`);
try { await p.goto(URL_ALVO, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
catch (e) { console.log('  falhou ao abrir:', e.message.slice(0, 90)); await b.close(); process.exit(1); }
await p.waitForTimeout(9000);

const achado = await p.evaluate(() => {
  const j = o => JSON.parse(JSON.stringify(o));
  const custom = [...new Set([...document.querySelectorAll('*')]
    .map(e => e.tagName.toLowerCase()).filter(t => t.includes('-')))];

  const alvo = document.querySelector('vturb-smartplayer, [id^="vid_"], [class*="vturb"], [class*="smartplayer"]');
  const out = {
    titulo: document.title.slice(0, 70),
    customElements: custom,
    scripts: [...document.querySelectorAll('script[src]')].map(s => s.src)
      .filter(s => /vturb|converteai|panda|vsl/i.test(s)).slice(0, 5),
    videos: document.querySelectorAll('video').length,
    iframes: [...document.querySelectorAll('iframe')].map(f => (f.src || '').slice(0, 70)),
    encontrouPlayer: !!alvo,
    tagDoPlayer: alvo ? alvo.tagName.toLowerCase() : null,
  };

  if (!alvo) return j(out);

  /* Os caminhos possíveis para a posição, em ordem do mais provável.
     Reportamos QUAL respondeu — assumir e errar aqui produziria uma curva
     de retenção inventada, que é pior que curva nenhuma. */
  const tentativas = {};
  const reg = (nome, fn) => { try { const v = fn(); tentativas[nome] = (v === undefined ? 'undefined' : v); } catch (e) { tentativas[nome] = 'erro: ' + e.message.slice(0, 40); } };

  reg('el.currentTime', () => alvo.currentTime);
  reg('el.getCurrentTime()', () => alvo.getCurrentTime && alvo.getCurrentTime());
  reg('el.duration', () => alvo.duration);
  reg('el.querySelector(video).currentTime', () => alvo.querySelector('video')?.currentTime);
  reg('el.shadowRoot(video).currentTime', () => alvo.shadowRoot?.querySelector('video')?.currentTime);
  reg('document video[0].currentTime', () => document.querySelector('video')?.currentTime);
  reg('smartplayer global', () => typeof window.smartplayer);
  reg('smartplayer.instances', () => window.smartplayer?.instances?.length);
  reg('vturb global', () => typeof window.vturb);

  out.tentativas = tentativas;
  out.propriedadesDoElemento = Object.getOwnPropertyNames(Object.getPrototypeOf(alvo))
    .filter(k => !k.startsWith('__')).slice(0, 40);
  return j(out);
});

console.log('  título:', achado.titulo);
console.log('  custom elements:', achado.customElements.join(', ') || '(nenhum)');
console.log('  scripts de player:', achado.scripts.join('\n                     ') || '(nenhum)');
console.log('  <video> na página:', achado.videos, '| iframes:', achado.iframes.length);
if (achado.iframes.length) achado.iframes.forEach(f => console.log('    iframe:', f));

if (!achado.encontrouPlayer) { console.log('\n  nenhum player da VTurb nesta página\n'); await b.close(); process.exit(0); }

console.log('\n  player encontrado:', achado.tagDoPlayer);
console.log('  caminhos para a posição:');
for (const [k, v] of Object.entries(achado.tentativas)) console.log(`    ${k.padEnd(34)} ${v}`);
console.log('  métodos do elemento:', achado.propriedadesDoElemento.join(', ').slice(0, 300));

// dá play e vê se a posição anda — é o teste que importa
console.log('\n  dando play e observando a posição…');
await p.evaluate(() => {
  const v = document.querySelector('video');
  if (v) { v.muted = true; v.play().catch(() => {}); }
  const el = document.querySelector('vturb-smartplayer');
  try { el && el.play && el.play(); } catch (e) {}
});
await p.waitForTimeout(7000);

const depois = await p.evaluate(() => {
  const alvo = document.querySelector('vturb-smartplayer');
  const r = {};
  try { r['el.currentTime'] = alvo?.currentTime; } catch (e) {}
  try { r['interno'] = alvo?.querySelector('video')?.currentTime; } catch (e) {}
  try { r['shadow'] = alvo?.shadowRoot?.querySelector('video')?.currentTime; } catch (e) {}
  try { r['document video'] = document.querySelector('video')?.currentTime; } catch (e) {}
  return JSON.parse(JSON.stringify(r));
});
for (const [k, v] of Object.entries(depois)) console.log(`    ${k.padEnd(20)} ${v}`);

await b.close();
