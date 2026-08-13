import { contaAtual, ativos, siteKey } from '@/lib/dados';
import { Cabecalho, AindaSemColeta } from '@/components/ui/estados';

export const metadata = { title: 'Vídeos — Régua' };

export default async function Videos() {
  const conta = await contaAtual();
  const lista = (await ativos(conta.id)).filter(a => a.kind === 'vsl' && a.sessions > 0);

  return (
    <div className="max-w-5xl space-y-5">
      <Cabecalho
        sobre="Retenção de vídeo"
        titulo="Vídeos"
        descricao="Onde as pessoas param de assistir, quantas chegam no momento da oferta, e quais trechos elas voltam para rever."
      />

      {!lista.length ? (
        <AindaSemColeta
          titulo="Nenhum vídeo detectado ainda"
          porque="O mesmo script da página de vendas mede vídeo — você não precisa instalar nada a mais nem marcar nada. Ele procura vídeo na página sozinho e começa a medir quando alguém der play."
          chave={await siteKey(conta.id)}
          passos={[
            {
              titulo: 'Nada a marcar',
              texto: <>O script já instalado acha <span className="font-mono">&lt;video&gt;</span>, YouTube, Vimeo e o player novo da VTurb sem configuração.</>,
            },
            {
              titulo: 'Marque o pitch',
              texto: <>Opcional, mas é a métrica que mais importa: <span className="font-mono">data-vsl-pitch</span> com o segundo em que a oferta aparece.</>,
            },
            {
              titulo: 'Rode tráfego',
              texto: 'A curva de retenção precisa de volume para não ser ruído — o mesmo mínimo de 300 sessões vale aqui.',
            },
          ]}
          exemplo={`<!-- funciona sem nenhum atributo -->\n<video src="/vsl.mp4" controls></video>\n\n<!-- opcional: o segundo em que a oferta entra -->\n<video src="/vsl.mp4" data-vsl-pitch="612"></video>`}
          aviso={
            <>
              <strong className="font-semibold">Vídeo em iframe de outro domínio sem API não é
              mensurável por ninguém de fora</strong> — o navegador proíbe, e não é questão de
              esforço. Player nativo, YouTube, Vimeo e o player novo da VTurb expõem API e
              funcionam. O embed antigo da VTurb, em iframe puro, não.
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {lista.map(v => (
            <div key={v.key} className="card p-5">
              <h2 className="font-mono text-[14px]">{v.key}</h2>
              <p className="mt-1 text-[11.5px] text-faint">
                {v.sessions.toLocaleString('pt-BR')} sessões
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
