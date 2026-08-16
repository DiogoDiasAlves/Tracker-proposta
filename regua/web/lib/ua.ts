/* Sistema operacional e navegador a partir do User-Agent.
   Sem biblioteca: são poucas categorias e o mesmo cabeçalho já chega em toda
   requisição, então um regex resolve — igual ao detector de mobile do
   tracker (tracker/core.js), só que do lado do servidor.

   A ordem importa: navegador embutido (Instagram/Facebook) e Edge/Opera
   incluem o token "Chrome" ou "Safari" no próprio UA, então precisam ser
   testados antes dos genéricos — senão todo tráfego de anúncio no in-app
   browser do Instagram apareceria como "Chrome". */

export function sistemaOperacional(ua: string): string | null {
  if (/iPhone OS|CPU OS \d/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}

export function navegador(ua: string): string | null {
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Facebook (in-app)';
  if (/Instagram/.test(ua)) return 'Instagram (in-app)';
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/FxiOS/.test(ua)) return 'Firefox';
  if (/CriOS/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return null;
}
