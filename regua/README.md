# Régua

Mapa de retenção por bloco para páginas de vendas.

Você vê a conversão final e nada mais, e passa três dias reescrevendo a headline
quando o problema estava no preço. A Régua mostra o bloco.

Implementa a proposta em [`../index.html`](../index.html). Onde este código e a
proposta discordarem, a proposta está certa — é o documento assinado.

---

## Rodar

Sem dependências. Node 22.5+ (usa o `node:sqlite` nativo).

```bash
npm start                       # http://localhost:8787
```

| Endereço | O quê |
|---|---|
| `/` | painel |
| `/r.js` | tracker, para colar nas páginas |
| `/demo/pagina-exemplo.html` | página instrumentada para teste |

Para popular com tráfego sintético e ver o painel com dados:

```bash
node tools/simular.js http://localhost:8787 1200
```

Testes da regra de visibilidade do tracker (sem navegador):

```bash
node tools/testar-tracker.js
```

---

## Instalar numa página de vendas

```html
<!-- nomeie cada seção -->
<section data-block="hero"> ... </section>
<section data-block="problema"> ... </section>
<section data-block="oferta">
  <button data-cta="checkout-principal">Comprar</button>
</section>

<!-- cole antes do fechamento do body -->
<script src="https://SEU-HOST/r.js"
        data-page="oferta-relogio-uk"
        data-version="1" defer></script>
```

Um bloco equivale a uma unidade de argumento: headline, prova social, oferta,
garantia. De 10 a 15 por página. Granularidade menor gera ruído; maior perde
resolução. **Mantenha os nomes estáveis entre versões** — renomear quebra a
comparação.

Não há cadastro de oferta a fazer. A página aparece no painel na primeira sessão.

### Conversão

A Régua não mede fora da página, então a venda precisa ser reportada de volta.
Ao clicar num CTA que seja um link, o tracker acrescenta `?rg_s=<sessão>` ao
destino. Na página de obrigado, feche o circuito com uma das duas formas:

```html
<img src="https://SEU-HOST/c.gif?s=SESSAO_DA_URL" width="1" height="1" alt="">
```

```js
fetch('https://SEU-HOST/c?s=' + new URLSearchParams(location.search).get('rg_s'));
```

Sem isso, o painel mostra cliques em botão — e clique em botão não é venda.

---

## O que cada número mede

As regras abaixo são as regras reais, incluindo onde cada uma falha.

### Alcance — confiança alta
Quantas sessões efetivamente viram o bloco. O bloco só conta quando ocupa
**metade da tela por meio segundo seguido** (ou metade da própria altura, para
blocos baixos que nunca ocupariam metade da tela). Arrastar a barra de rolagem
do topo ao rodapé em um segundo registra **zero** blocos.

> **Onde falha:** no celular, os 2 ou 3 primeiros blocos às vezes cabem juntos na
> tela e são marcados no mesmo instante. A queda entre eles dá quase zero, e isso
> não significa que o topo está bom. Para o começo da página, olhe tempo e saída.

### Queda relativa — confiança alta
`1 − (chegaram no próximo ÷ chegaram neste)`. Normal por bloco: 5% a 10%. Acima
de 20% no meio da página, investigue. O primeiro bloco perde de 20% a 35% — é o
filtro do tráfego frio, não um defeito.

> **Por que não saída absoluta:** o bloco 1 sempre lidera em números brutos,
> porque todo mundo passa por ele. Ordenar por saída absoluta faz você reescrever
> o topo da página para sempre e nunca chegar no problema. Por isso o cálculo do
> maior gargalo **ignora o primeiro bloco de propósito**.

### Tempo de atenção — confiança média
Quanto tempo o bloco ficou visível. Só conta com a aba **em primeiro plano**.
Reentradas somam ao mesmo total. O painel exibe a **mediana**, nunca a média —
uma aba esquecida aberta por 40 minutos destruiria a média. O valor é dividido
pela altura renderizada (`tempo /100px`); sem isso, todo bloco longo pareceria
interessante só por ser longo.

> **Isso mede tempo de tela, não tempo de leitura.** Se a pessoa deixou a página
> aberta e foi olhar outra coisa, nenhuma tecnologia web percebe. O tempo nunca
> decide sozinho — ele serve para qualificar a queda.

### Reentradas — confiança alta
Quantas vezes, em média, a pessoa voltou ao bloco. `1,0–1,3` é leitura linear.
**Acima de 1,5** em preço, oferta ou garantia é dúvida não resolvida; em bloco de
conteúdo, é texto que não ficou claro na primeira passada. A métrica mais
subestimada do painel: reentrada alta é a assinatura de uma objeção sem resposta.

### Saída no bloco — confiança média-alta
Percentual de quem chegou no bloco e encerrou a sessão ali. Registra o bloco
visível mais profundo no momento em que a aba foi fechada. **Quem clicou no CTA e
foi para o checkout é excluído da conta** — senão o bloco de oferta apareceria
como o pior da página justamente quando estivesse funcionando.

> Quando o navegador é encerrado de forma abrupta, a atribuição pode ficar até 10
> segundos defasada. Use como confirmação da queda relativa, não isoladamente.

### Sessões — use de forma relativa
Conta quando a página carrega. Recarregar **não** cria sessão nova; abrir em duas
abas cria duas (é a semântica do `sessionStorage`, onde o id vive).

> **Não tente bater este número com o gerenciador de anúncios.** Vai dar diferente
> sempre: o Meta conta cliques, a Régua conta carregamentos, e bloqueadores
> impedem parte da coleta. Compare bloco contra bloco e versão contra versão.

---

## O diagnóstico

Sozinha, "queda alta" é ambígua: pode ser um bloco que ninguém leu ou um bloco
que todo mundo leu e rejeitou. São problemas opostos, com soluções opostas.

| | Queda baixa | Queda alta |
|---|---|---|
| **Tempo alto** | **FUNCIONA** — não mexa; estude e replique | **TRAVA** — leram e desistiram. Prioridade máxima |
| **Tempo baixo** | **IGNORADO** — passou batido. Candidato a corte | **REJEIÇÃO** — bateram o olho e saíram. Reescreva o gancho |

"Tempo alto" é acima da mediana da própria página. "Queda alta" é 15% ou mais.

---

## Quatro regras de uso

Quebrar qualquer uma invalida a leitura.

1. **Uma alteração por versão.** Mudou qualquer coisa, incremente `data-version`.
   Alterou três blocos e a conversão subiu? Você não sabe qual funcionou — e
   provavelmente um deles piorou sem você perceber.
2. **Mínimo de 300 sessões.** Abaixo disso os números são ruído e o painel avisa.
   Para detectar diferenças de 10 pontos percentuais, são necessárias ~400 por versão.
3. **Olhe o bloco que você mexeu.** Com 11 blocos, é praticamente garantido que
   dois ou três vão "melhorar" ou "piorar" por acaso. Perseguir isso é otimizar ruído.
4. **Mobile e desktop são páginas diferentes.** O painel separa por padrão.

---

## O que a Régua não faz

- **Não grava a tela de ninguém.** Mede posição de rolagem e tempo. Sem vídeo, sem replay.
- **Não coleta dado pessoal.** Sem nome, e-mail, cookie ou identificação. **Nenhum IP é armazenado** — não há coluna capaz de guardar um.
- **Não diz por que o lead saiu.** Diz onde. A hipótese continua sendo sua, partindo do bloco certo.
- **Não mede fora da página.** Se o problema é o checkout ou o preço em si, a página vai parecer ótima e a conversão vai continuar ruim.
- **Não substitui teste A/B simultâneo.** A comparação é sequencial: v1 num período, v2 no seguinte. Rode em períodos equivalentes — terça contra sábado mistura conteúdo com dia da semana.
- **Não funciona em plataforma fechada.** Sem acesso ao HTML das seções, não há como marcar os blocos.

UTMs e referrer são gravados desde já, mas o painel ainda não expõe filtros por
origem de tráfego. Guardar agora evita descobrir daqui a três meses que os dados
históricos não existem.

---

## Estrutura

```
tracker/r.js        script da página (~9KB, sem dependências)
server/
  index.js          HTTP: coleta, API, estáticos
  db.js             abertura do banco, páginas, facetas
  schema.sql        esquema — nenhuma coluna guarda dado pessoal
  ingest.js         validação e gravação; envios são idempotentes
  metrics.js        alcance, queda, tempo/100px, reentradas, saída, veredito
dashboard/          painel (HTML + JS, sem build)
demo/               página de vendas instrumentada, para teste
tools/
  simular.js        tráfego sintético
  testar-tracker.js testes da regra de visibilidade
data/regua.db       SQLite — backup é copiar este arquivo
```

O tracker envia **totais acumulados**, não incrementos. Lote duplicado, fora de
ordem ou perdido não corrompe nada: o servidor sobrescreve em vez de somar.

## Produção

```bash
PORT=8787 REGUA_DB=/var/lib/regua/regua.db node server/index.js
```

Atrás de um proxy com TLS (Caddy resolve em duas linhas). O `/e` responde a
qualquer origem — é o comportamento necessário para um tracker instalado em
domínios de terceiros. Backup: copie `regua.db` (e os arquivos `-wal`/`-shm`, ou
rode `sqlite3 regua.db ".backup"`).
