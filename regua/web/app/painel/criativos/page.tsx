import { contaAtual, db } from '@/lib/dados';
import { Cabecalho, AindaSemColeta } from '@/components/ui/estados';

export const metadata = { title: 'Criativos — Régua' };

export default async function Criativos() {
  const conta = await contaAtual();

  // Sessões que já chegaram com id de anúncio na URL. É o pré-requisito real:
  // sem ad_id não há como amarrar gasto de criativo a comportamento na página.
  const { rows } = await db.query(
    `SELECT COUNT(*) FILTER (WHERE ad_id IS NOT NULL)::int AS com,
            COUNT(*)::int AS total,
            COUNT(DISTINCT ad_id)::int AS criativos
     FROM sessions WHERE account_id = $1`,
    [conta.id]
  );
  const { com, total, criativos } = rows[0];

  return (
    <div className="max-w-5xl space-y-5">
      <Cabecalho
        sobre="Meta Ads"
        titulo="Criativos"
        descricao="A Meta diz qual criativo tem clique barato. A Régua diz onde o tráfego de cada criativo morre na página. Nenhuma das duas responde isso sozinha."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cartao rotulo="Sessões com id de anúncio" valor={`${com.toLocaleString('pt-BR')}`}
                nota={total ? `de ${total.toLocaleString('pt-BR')} no total` : 'nenhuma sessão ainda'}
                alerta={total > 0 && com === 0} />
        <Cartao rotulo="Criativos distintos" valor={criativos.toLocaleString('pt-BR')} nota="vistos até agora" />
        <Cartao rotulo="Conta da Meta" valor="—" nota="não conectada" alerta />
      </div>

      <AindaSemColeta
        titulo="Faltam duas coisas, e uma delas é fila externa"
        porque="A junção entre gasto e comportamento depende de o id do anúncio chegar na URL e de a conta de anúncios estar conectada. A segunda passa por revisão da Meta, que leva semanas e não depende de código."
        passos={[
          {
            titulo: 'Parâmetros de URL',
            texto: <>No nível de anúncio, inclua <span className="font-mono">utm_content={'{{ad.id}}'}</span>. Sem isso a Régua vê o tráfego mas não sabe de qual criativo veio.</>,
          },
          {
            titulo: 'App e verificação',
            texto: 'App no Meta for Developers e Verificação de Negócio com CNPJ. De uma a duas semanas.',
          },
          {
            titulo: 'App Review de ads_read',
            texto: 'Justificativa por permissão e gravação de tela do fluxo. De três a sete dias úteis depois de submetido.',
          },
        ]}
        exemplo={`utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_term={{adset.id}}`}
        aviso={
          <>
            <strong className="font-semibold">Comece a fila da Meta antes do código.</strong> É o
            único item cujo prazo não depende de nós — o resto da integração fica pronto
            esperando a aprovação chegar.
          </>
        }
      />
    </div>
  );
}

function Cartao({ rotulo, valor, nota, alerta }: {
  rotulo: string; valor: string; nota: string; alerta?: boolean;
}) {
  return (
    <div className="card p-5">
      <p className="text-[11px] uppercase tracking-wider text-faint">{rotulo}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tnum">{valor}</p>
      <p className={`mt-2 text-[11.5px] ${alerta ? 'text-warn' : 'text-muted'}`}>{nota}</p>
    </div>
  );
}
