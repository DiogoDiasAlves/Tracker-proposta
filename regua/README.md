# Régua

Tracking de funil por etapa: página de vendas, vídeo e quiz.

Você vê a conversão final e nada mais, e passa três dias reescrevendo a headline
quando o problema estava no preço. A Régua mostra a etapa.

Os três produtos são o mesmo modelo — um funil de etapas ordenadas onde a pessoa
avança, para, volta e desiste. Só muda o que é etapa e o que é progresso:

| Produto | Etapa | Progresso |
|---|---|---|
| Página | bloco | scroll |
| Vídeo | segundo do vídeo | playback |
| Quiz | pergunta | responder |

A semântica das métricas de página está em [`../index.html`](../index.html), a
proposta assinada. Onde este código e ela discordarem, ela está certa.

---

## Rodar

```bash
docker compose up -d              # Postgres na 55432
npm install
npm run dev                       # http://localhost:3100
node tools/criar-usuario.js você@exemplo.com "sua-senha" "Seu Nome"
```

| Endereço | O quê |
|---|---|
| `/painel` | o painel, atrás de login |
| `/r.js` | tracker, para colar nas páginas |
| `/e`, `/c`, `/c.gif` | coleta e conversão |
| `/demo/pagina-exemplo.html` | página instrumentada |
| `/demo/quiz-exemplo.html` | quiz instrumentado |

Tráfego sintético para ver o painel com volume:

```bash
node tools/simular.js           # página de vendas, 1200 sessões
node tools/simular-vsl-quiz.js  # vídeo e quiz
node tools/simular-meta.js      # insights da Meta, para provar a junção
```

### Testes

```bash
npm run testar             # regra de visibilidade, DOM simulado e relógio controlado
npm run testar:navegador   # tracker em Chrome real, emulando iPhone
npm run testar:quiz        # percorre o quiz E procura dado pessoal no banco
npm run testar:real -- <url>   # injeta o tracker numa página real da internet
```

`testar:quiz` é o mais importante: digita um e-mail e um telefone no formulário
e depois varre seis tabelas procurando por eles. Se aparecerem, falha. É a
garantia de LGPD virando verificação executável em vez de promessa em documento.

Os que usam Chrome se ignoram sozinhos se não acharem o navegador; aponte com
`CHROME=/caminho`.

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
        data-key="SUA_CHAVE"
        data-page="oferta-relogio-uk"
        data-version="1" defer></script>
```

A chave é pública e pode ficar exposta no HTML: ela só diz de qual conta é o
evento que chega, não autoriza ler nada. Aparece em `/painel/instalar`.

**O mesmo script mede vídeo e quiz.** Vídeo não precisa de marcação nenhuma —
ele acha `<video>`, YouTube, Vimeo e o player novo da VTurb sozinho. Quiz usa
`data-quiz-step`, `data-quiz-question` e `data-quiz-option`. Os três podem
conviver na mesma página.

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
abas cria duas (é a semântica do `sessionStorage`, onde o id vive). O acumulado
de cada bloco também mora ali, então um F5 no meio da leitura continua somando de
onde parou em vez de recomeçar do zero.

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

"Tempo alto" é acima da mediana do próprio funil. "Queda alta" depende do
produto: **15%** em página e vídeo, **5%** em quiz. Rolar para o próximo bloco
não custa nada, mas responder mais uma pergunta é trabalho — e o mercado de quiz
trabalha com teto de 5% de perda por etapa.

---

## Quatro regras de uso

Quebrar qualquer uma invalida a leitura.

1. **Uma alteração por versão.** Mudou qualquer coisa, incremente `data-version`.
   Alterou três blocos e a conversão subiu? Você não sabe qual funcionou — e
   provavelmente um deles piorou sem você perceber.

   A versão aparece no painel **na hora**: no instante em que o primeiro
   visitante carrega a página com `data-version="2"`, a pílula v2 surge. Sem
   cadastro e sem espera.

   Esquecer de subir a versão é pior que não versionar, porque os dois
   períodos ficam somados num só e parecem limpos. Por isso o painel avisa
   quando a página parece ter mudado sem a versão trocar — ele compara a
   altura mediana de cada bloco entre um dia e o próximo em que aquele bloco
   teve base suficiente. É **sinal, não garantia**: trocar uma headline por
   outra do mesmo tamanho não muda altura nem estrutura e passa batido.
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
tracker/            fontes do script da página; vanilla, sem dependência
  core.js           sessão, estado que sobrevive ao F5, transporte, UTM, CTA
  page.js           blocos por scroll
  vsl.js            vídeo, com adaptadores por player
  quiz.js           perguntas e respostas
  build.js          concatena em dist/r.js — sem bundler, de propósito
metrics/verdict.js  o veredito: lógica pura, sem banco, serve aos três produtos
metrics/teste.js    vencedor bayesiano, cálculo exato
db/                 esquema, migrações e consultas
  migrations/       .sql numerados, aplicados em transação
  meta.js           cifra do token e a junção com a Meta
web/                app Next.js: painel, login e coleta
demo/               página e quiz instrumentados, para teste
tools/              simuladores e suítes de teste
```

O tracker envia **totais acumulados**, não incrementos. Lote duplicado, fora de
ordem ou perdido não corrompe nada: o servidor sobrescreve em vez de somar.

## Produção

```bash
DATABASE_URL=postgres://... REGUA_SECRET=... npm --workspace web run build
DATABASE_URL=postgres://... REGUA_SECRET=... npm --workspace web start
```

Atrás de um proxy com TLS. O painel tem login próprio — `exigirConta()` roda no
servidor antes de qualquer consulta, e a conta vem do vínculo do usuário, nunca
de parâmetro de URL.

O `/e` responde a qualquer origem — é o comportamento necessário para um tracker
instalado em domínios de terceiros. Ele tem limite de vazão por endereço (600 de
folga, 60/s sustentados), calibrado alto de propósito: apertar mais descartaria
visitante real vindo de operadora de celular, onde milhares de assinantes
compartilham um IP. O endereço é reduzido a um número com sal aleatório, vive só
na memória e nunca é gravado.

---

## Meta Ads

A Meta diz qual criativo tem clique barato. A Régua diz onde o tráfego de cada
um morre na página. **Nenhuma das duas responde isso sozinha** — e é o
cruzamento, não o gasto, que muda decisão.

### O que precisa, e o que trava

| Requisito | Prazo |
|---|---|
| App no Meta for Developers | dias |
| Verificação de Negócio (CNPJ) | 1–2 semanas |
| App Review de `ads_read` | 3–7 dias úteis após submeter |

**Comece a fila antes do código.** É o único item cujo prazo não depende de
nós. Em modo de desenvolvimento o app já funciona na sua própria conta de
anúncios, então dá para usar tudo antes da aprovação sair.

### A chave de junção

Sem isto nada funciona. Nos **Parâmetros de URL**, no nível de anúncio:

```
utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_term={{adset.id}}
```

A Meta preenche `{{ad.id}}` sozinha. O painel avisa quando chega tráfego sem
ele.

### Ambiente

```bash
REGUA_SECRET=...        # cifra o token. Sem ela a conexão falha de propósito
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=https://SEU-HOST/api/meta/callback
META_API_VERSION=v25.0  # tudo anterior a v24.0 foi depreciado em 09/06/2026
REGUA_CRON_SECRET=...   # para a sincronização diária
```

O token da conta de anúncios é gravado com **AES-256-GCM**, com a chave fora do
banco. Um dump do banco não vira acesso à conta de anúncios de ninguém, e token
adulterado falha ao decifrar em vez de virar chamada esquisita à API.

Pedimos só `ads_read` — leitura. Nunca `ads_management`, que permitiria alterar
campanha: a Régua não precisa, e pedir permissão a mais atrasa o App Review sem
ganho nenhum.

### Sincronização

Manual pelo botão no painel, ou diária por agendador:

```bash
curl -X POST https://SEU-HOST/api/meta/cron -H "Authorization: Bearer $REGUA_CRON_SECRET"
```

Reimportar o mesmo dia sobrescreve, que é o certo — a Meta revisa números
retroativamente por alguns dias.

### Por que os números não batem com o Gerenciador

Nunca vão bater, e a tela mostra os dois lados de propósito. A Meta conta
**clique**, a Régua conta **página carregada**, e bloqueador come parte. A
coluna *Aproveitamento* é essa diferença: muito abaixo de 80% costuma ser
página lenta — gente que clica e desiste antes de abrir.

---

## Antes de rodar com tráfego real

Ordem importa: os três primeiros são bloqueio, o resto é o que evita descobrir
problema tarde.

### 1. Publicar em HTTPS

Página de vendas é https. O navegador **bloqueia** requisição http vinda de
página https, então a coleta precisa estar em domínio com TLS. Nos testes isso
foi contornado com `--allow-running-insecure-content`, que não existe na vida
real.

Ideal: subdomínio próprio (`r.seudominio.com`) apontando para o app. Domínio
próprio também sofre menos bloqueio de extensão que domínio de terceiro.

### 2. Confirmar que a conversão volta

**É o item que mais falha na prática.** A Régua não mede fora da página: ao
clicar num CTA que é link, o script acrescenta `?rg_s=<sessão>` ao destino, e a
página de obrigado devolve isso com `/c.gif?s=`.

O elo frágil é o meio do caminho: **muitas plataformas de checkout descartam
parâmetro que não conhecem** no redirecionamento. Se isso acontecer, a
conversão nunca é atribuída, e o CPA real — que é o número que justifica o
produto — fica vazio.

Teste antes de confiar no número: clique num CTA, vá até a página de obrigado
e confira se `rg_s` sobreviveu na URL. Se não sobreviveu, o caminho é usar o
parâmetro que aquela plataforma preserva (a maioria tem um campo de metadado
ou `utm_content` livre) e ler dele.

### 3. Colar o parâmetro da Meta

`utm_content={{ad.id}}` nos Parâmetros de URL, nível de anúncio. Sem ele a tela
de Criativos não tem em que se apoiar.

### 4. Backup do banco

Hoje o Postgres roda em Docker com volume nomeado. Em produção, use um
gerenciado com backup automático, ou agende `pg_dump`. Sem isso, um `docker
volume rm` distraído apaga todo o histórico — e histórico de retenção não se
recupera.

### 5. O que ainda não foi testado contra o mundo real

Honestidade sobre os limites do que foi verificado:

| Item | Estado |
|---|---|
| Página de vendas, vídeo e quiz | testados em Chrome real, incluindo página pública na internet |
| Chromium, WebKit (Safari) e Firefox | os três passam a mesma jornada, incluindo o beacon de saída |
| YouTube | testado com embed real; o coletor acrescenta `enablejsapi` sozinho |
| Vimeo | ponte com o SDK verificada (lê duração); **reprodução não exercitada** — o player recusa tocar em ambiente automatizado |
| Player da VTurb | testado contra página real: expõe `currentTime` e `duration`, curva de retenção completa |
| API da Meta | **nunca chamada de verdade** — todo o fluxo foi verificado com dado sintético |
| Volume alto | maior teste foi ~3 mil sessões |

### 6. Depurar numa página real

`/r.js?dev=1` devolve a versão legível do tracker, com os comentários. E no
console:

```js
regua.debug()      // o que cada coletor está contando agora
regua.session()    // o id desta sessão, para achar a linha no banco
```
