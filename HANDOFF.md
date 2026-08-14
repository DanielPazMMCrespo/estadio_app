# HANDOFF COMPLETO — App de manutenção do Estádio Municipal de Leiria

Documento único e autossuficiente. Tudo o que foi feito, tudo o que foi medido,
tudo o que estava planeado. Escrito para ser entregue a outro agente ou a outra IA.

Data: 2026-08-14
Pasta do projeto: `C:\dev\estadio\maintenance_app`

---

# PARTE 1 — O QUE É ISTO E PARA QUEM

## 1.1 O produto

PWA (Progressive Web App) de manutenção diária para o Estádio Municipal de Leiria.
Cliente/marca: **mmcrespo** (energia · tecnologia · edifícios).

Tem de gerir:
- **Ocorrências / avarias** (já existia, com defeitos graves)
- **Tarefas para hoje e amanhã** (não existia)
- **Notas soltas** (não existia)
- **Stock de ferramentas** com quantidades (não existia — só havia uma lista de nomes)
- **Equipamento instalado no estádio** com histórico (não existia)

## 1.2 O utilizador real — isto comanda todas as decisões

Um técnico de manutenção de **60 anos**. De **luvas**. Com **uma mão** livre.
Ao lado de **máquinas a fazer barulho**. Muitas vezes **ao sol**, no relvado ou no exterior.
Quer **registar tudo sem ter de pensar**.

Consequências que não se negociam:
- Nada de campos obrigatórios que ele não saiba responder no momento.
- Nada que precise de duas mãos, de precisão de dedo, ou de ler letra pequena.
- Se falhar a ligação, grava sempre. E diz-lho de forma honesta.
- Português de Portugal em tudo o que ele vê.

## 1.3 A barra — medida, não opinada

| Critério | Alvo |
|---|---|
| Alvo de toque visível | **≥ 48 × 48 px CSS** |
| Texto de corpo | **≥ 18 px CSS** |
| Do ecrã bloqueado até a avaria gravada | **≤ 3 toques** |
| Erros de consola | **0** |
| Scroll horizontal | **nenhum** |

Regra de ouro do projeto: **números só contam se vierem do medidor.**
Relatos de agentes são verificados, nunca aceites.

---

# PARTE 2 — STACK E INVENTÁRIO DE CÓDIGO

## 2.1 Stack

- **Vite 5** + **vanilla JavaScript** (ES2022, ES modules). Sem frameworks. Sem TypeScript.
- **Dexie 4** sobre IndexedDB. Offline total.
- Service Worker próprio (`public/sw.js`), stale-while-revalidate.
- **Vitest** + `fake-indexeddb` para unitários. **Playwright** para E2E e para o medidor.
- Servidor de dev em `http://localhost:5173` (`npm run dev`).

## 2.2 Ficheiros (estado no início do trabalho)

```
maintenance_app/
├── index.html                    38 linhas
├── package.json                  25
├── vite.config.js                22
├── playwright.config.ts          47   (Pixel 5 + iPhone 13, webServer reuseExistingServer)
├── vitest.config.ts
├── public/
│   ├── sw.js                     76
│   ├── manifest.webmanifest      25
│   ├── favicon.ico
│   └── icons/                    (logo-mmcrespo.png, icon-192, icon-512, e ~10 variantes)
├── src/
│   ├── main.js                  1071  ← controlador da app + formulário inline gigante
│   ├── styles/
│   │   ├── main.css              118  ← tinha @import de Google Fonts
│   │   ├── theme.css             188  ← tokens, tema preto puro
│   │   └── components.css       1104  ← todos os componentes
│   ├── db/
│   │   ├── db.js                 356  ← Dexie, schema v1..v3, helpers de fotos
│   │   ├── reportsRepo.js        238
│   │   ├── locationsRepo.js      385  ← STADIUM_HIERARCHY, 33 divisões em 7 setores
│   │   └── materialsRepo.js      131  ← só nomes, sem quantidades
│   ├── services/
│   │   ├── audioService.js       160  ← MediaRecorder, notas de voz
│   │   ├── pdfService.js         268  ← ficha de obra em PDF
│   │   └── photoEditor.js        300  ← canvas: setas, círculos, caixa, pincel
│   └── ui/
│       ├── header.js              65
│       ├── bottomNav.js          142  ← 4 abas + botão flutuante central
│       ├── stadiumNavigator.js   389  ← acordeão de setores → salas (ecrã inicial)
│       ├── history.js            338  ← feed de ocorrências
│       ├── dashboard.js          175  ← métricas/KPIs
│       ├── reportDetail.js       262  ← ficha, estado, PDF
│       ├── locationModal.js      368
│       ├── toast.js               76
│       └── stadiumMap.js         321  ← CÓDIGO MORTO, ninguém o importa
└── tests/
    ├── unit/          (10 ficheiros, 114 testes)
    ├── e2e/           (4 ficheiros, tiers 1-4)
    ├── fixtures/      (sample_before.jpg, sample_large.jpg)
    └── helpers/       (setup.js com fake-indexeddb, mock-server.ts)
```

## 2.3 Estrutura de dados do estádio (já existia, é boa — aproveitar)

`src/db/locationsRepo.js` exporta `STADIUM_HIERARCHY`: 7 setores, 33 divisões, com IDs fixos.

```
SEC_POENTE   (LOC_WEST_STAND)  Bancada Poente (Principal & VIP)      6 salas
  LOC_WEST_VIP, LOC_WEST_BOXES, LOC_WEST_PRESS, LOC_WEST_BARS,
  LOC_WEST_BATH, LOC_WEST_LIFTS
SEC_NASCENTE (LOC_EAST_STAND)  Bancada Nascente                     4 salas
SEC_NORTH    (LOC_NORTH_STAND) Topo Norte                           4 salas
SEC_SOUTH    (LOC_SOUTH_STAND) Topo Sul                             3 salas
SEC_PITCH    (LOC_PITCH)       Relvado & Pista de Atletismo         5 salas
  LOC_PITCH, LOC_PITCH_IRRIGATION, LOC_PITCH_BENCHES,
  LOC_PITCH_TRACK, LOC_PITCH_GOALS
SEC_TECH     (LOC_CHANGING)    Balneários & Zonas Técnicas          7 salas
  LOC_CHANGING_MAIN, LOC_CHANGING_VISITOR, LOC_CHANGING_REFS,
  LOC_TECH_PUMPS, LOC_TECH_ELEC, LOC_TECH_IT, LOC_TECH_DOPING
SEC_EXTERIOR (LOC_EXTERIOR)    Exterior, Portões & Apoio            4 salas
  LOC_EXT_GENERATOR, LOC_EXT_PT, LOC_EXT_LIGHTS, LOC_EXT_PARKING
```

---

# PARTE 3 — O MEDIDOR (a peça de infraestrutura mais importante)

Ficheiro criado: **`maintenance_app/audit/measure.mjs`** (~340 linhas).

```bash
cd C:\dev\estadio\maintenance_app
node audit/measure.mjs --label <nome>
```

Escreve:
- `audit/<nome>/report.md` — tabela da barra, sequência de toques, defeitos por ecrã
- `audit/<nome>/report.json` — o mesmo, para máquina
- `audit/<nome>/shots/*.png` — screenshots full-page reais a 390×844

O que faz, em Chromium com perfil iPhone 13 (390×844, isMobile, hasTouch, pt-PT):

1. **Sonda de alvos de toque.** Percorre
   `button, a[href], input, select, textarea, [role=button], [role=tab], [onclick], [tabindex], label[for], .issue-card, .room-row, .sector-card-header, .location-card, .filter-chip, .nav-tab`
   e reporta todos os visíveis com largura ou altura < 48px, com as dimensões reais.
2. **Sonda de texto.** `TreeWalker` sobre todos os nós de texto; para cada um lê o
   `font-size` computado do elemento pai e reporta os < 18px.
   Ignora nós de 1 caracter (chevrons, ×) para não dar falsos positivos em glifos decorativos.
3. **Sonda de overflow horizontal.** `scrollWidth - clientWidth` do documento.
4. **Contagem de toques.** Apaga o IndexedDB e o localStorage para simular arranque frio,
   conta o toque de abrir a app, depois cada gesto até gravar, e **confirma no IndexedDB
   que o registo ficou realmente lá** (abre a base `EstadioMaintenanceDB`, conta a store
   `reports` antes e depois). Sem isto, um agente pode "passar" o teste sem gravar nada.
5. **Erros de consola e pageerror** recolhidos em todo o percurso.
6. Faz `process.exit(1)` se a barra falhar — dá para usar em CI.

Ecrãs que percorre: `01-home`, `02-ocorrencias`, `03-metricas`, `04-definicoes`,
`05-nova-ocorrencia`.

**Aviso:** o medidor procura `#btn-nav-quick-add` para o segundo toque. Se a ação primária
mudar de sítio, ou se dá esse id ao novo botão, ou edita-se o medidor — mas **nunca
afrouxando a exigência de que o registo fique realmente gravado no IndexedDB**.

---

# PARTE 4 — MEDIÇÃO DE PARTIDA (real, 2026-08-14)

```
Alvos de toque    >= 48px    →  42 abaixo (o menor tinha 13px)     FALHA
Corpo de texto    >= 18px    → 154 abaixo (o menor tinha 10,4px)   FALHA
Toques até gravar <= 3       →   6, e NÃO GRAVOU                   FALHA
Erros de consola  0          →   0                                 passa
Scroll horizontal nenhum     →   0px                               passa
```

Piores casos concretos medidos:

| Elemento | Tamanho real |
|---|---|
| `.btn-del-mat` (apagar material) | **8,4 × 16 px** |
| `.btn-close-detail` (fechar folha) | 16,8 × 28,8 px |
| `.mat-checkbox` | 13 × 13 px |
| `.btn-mic-record` | 40 × 40 px |
| `.filter-chip` | altura 30 px |
| inputs de formulário | altura 45–46 px |
| `p.subtitle` "Estádio Municipal de Leiria" | **10,4 px** |
| `.status-text`, `.stat-label`, `.kpi-label` | 11,5 px |
| `.filter-chip` texto | 12,2 px |
| `.issue-description` (o corpo da avaria!) | 13,6 px |

---

# PARTE 5 — TODOS OS DEFEITOS ENCONTRADOS NA LEITURA DO CÓDIGO

Ordenados por gravidade. Encontrados a ler as 6641 linhas de fonte, não por suposição.

## 5.1 BLOQUEIOS

### B1 — É impossível registar uma avaria pelo botão +
`src/main.js` cria no formulário um `.searchable-select` com
`<input id="search-location-input">` e `<div id="location-dropdown">`.
**Nenhuma linha de código em todo o projeto preenche `#location-dropdown`.**
Não há listener no input, não há render de opções.
`saveReport()` (main.js ~934) faz:
```js
const locationId = locInput?.dataset.selectedId;
if (!locationId) { toast.error('Tem de selecionar um setor ou sala!'); return; }
```
`dataset.selectedId` só é preenchido por `openNewReport(prefill)` ou pelo callback do
`LocationModalComponent`. Logo:
- entrar por **"+ Avaria" dentro de uma sala** → funciona (vem pré-preenchido)
- entrar pelo **botão + da barra** → o local fica vazio, o dropdown nunca abre, **o guardar recusa sempre**

O medidor confirmou: *"BLOQUEIO: dropdown de localização não abre nenhuma opção"*.
Nenhum relatório de agente anterior mencionava isto. Só a medição o apanhou.

### B2 — Não existe motor de sincronização
O `PROJECT.md` lista `src/services/connectivity.js`, `syncQueue.js`, `syncEngine.js`,
`cloud/cloudInterface.js`, `cloud/mockCloudProvider.js`, `cloud/firebaseProvider.js`.
**Nenhum destes ficheiros existe no disco.**

Consequência: cada `create`/`update`/`remove` em qualquer repo escreve uma linha em
`sync_queue` dentro da transação (isso está bem feito), mas **ninguém lê nem drena essa fila**.
Cresce para sempre. `synced` fica sempre 0. O badge "Local" nunca muda para "Sincronizado".

## 5.2 ERROS

### E1 — O estado online/offline nunca muda
`src/main.js` `setupConnectivity()`:
```js
window.addEventListener('online',  () => { ... this.header.setOnlineState(true); });
window.addEventListener('offline', () => { ... this.header.setOnlineState(false); });
```
`HeaderComponent` (src/ui/header.js) só define **`updateStatus(isOnline)`**.
`setOnlineState` não existe → `TypeError` silencioso dentro do listener.
O indicador fica preso no valor que tinha ao abrir a app.

### E2 — O CSS dos toasts nunca foi escrito
`src/ui/toast.js` cria elementos com `.toast-container`, `.toast`, `.toast-success`,
`.toast-error`, `.toast-warning`, `.toast-info`, `.toast-icon`, `.toast-message`,
`.slide-in`, `.fade-out`. **Nenhuma destas classes existe nos três ficheiros CSS.**
As confirmações apareciam como texto solto sem fundo, sem posição, atrás da barra inferior.

### E3 — O tipo de letra vem da internet
`src/styles/main.css` linha 5:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```
Numa app de **offline total**. Sem rede, a fonte falha em silêncio e o layout muda.

### E4 — Token `--color-navy` usado e nunca definido
`main.css` usa `var(--color-navy)` em `.splash-screen { background }` e em `h1..h6 { color }`.
`theme.css` nunca o define. O splash ficava sem fundo.

### E5 — As fotos não são comprimidas
`main.js handlePhotoAdded()` faz `FileReader.readAsDataURL(file)` e guarda
`blobData: file` — **o ficheiro original da câmara**, que num telemóvel moderno são
3–8 MB por foto. O `PROJECT.md` promete "max 1280px, JPEG 0.75, ~180KB".
A compressão só acontece se o técnico **abrir o editor de anotações**
(`photoEditor.js` reduz a 1024px e exporta a 0.85), o que é opcional.
Duas ou três avarias com fotos e o IndexedDB estoura a quota.

### E6 — Código morto
`src/ui/stadiumMap.js` (321 linhas) não é importado por ninguém. Confirmado por grep.

### E7 — A documentação não corresponde ao disco
`PROJECT.md` descreve `reportList.js`, `reportForm.js`, `reportDetailModal.js`,
`photoService.js` — nomes que não existem. Descreve milestones M2 como "IN_PROGRESS" e
M3/M4 como "PLANNED" quando na verdade M3 está feito e M4 não existe.

## 5.3 FALHAS DE DESENHO PARA ESTE UTILIZADOR

### F1 — Campos obrigatórios que ele não sabe responder
Para registar uma avaria, o formulário exige: local, descrição, **data e hora**, **tempo gasto**.
Quem está ao lado de uma máquina a fazer barulho não sabe quanto tempo vai gastar
**antes** de fazer o trabalho. `input-time-spent` tem `required` e `min="1"`.

### F2 — O formulário tem 8 secções
Local, prioridade, estado inicial, descrição, nota de voz, data+tempo, materiais, fotos.
Um scroll longo para registar "o projetor da torre norte está fundido".

### F3 — Barra inferior branca sobre fundo preto
`.bottom-nav-wrapper { background: rgba(255,255,255,0.96); }` num tema `--color-bg: #000000`.
Uma faixa branca a cortar o ecrã.

### F4 — Contraste fraco para 60 anos ao sol
Tema preto puro com `--color-text-muted: #94A3B8` para texto de leitura.

### F5 — O ecrã inicial é um explorador de setores
Ele abre a app para **trabalhar**, não para explorar o estádio. A primeira coisa que vê
é um acordeão de 7 setores para abrir e fechar.

### F6 — Prioridade e estado geridos por manipulação de `style` inline em JS
`bindReportFormEvents()` faz `btn.style.borderColor = '...'` em vez de trocar classes.
Frágil e impossível de estilizar a partir do CSS.

### F7 — Muito CSS escrito como `style=""` inline dentro de template strings de JS
Espalhado por `main.js`, `header.js`, `history.js`, `locationModal.js`.
Torna impossível corrigir tamanhos a partir do CSS sem `!important`.

---

# PARTE 6 — A APP CONTRA A QUAL SOMOS JULGADOS

Guardadas **39 imagens reais** em `maintenance_app/.limble-ref/` com
`MANIFEST.md` a descrever cada uma. Fontes: App Store, Google Play,
help.limblecmms.com (Intercom), limble.com.

## 6.1 Descoberta importante: existem DUAS apps Limble

- **Nova, técnico-primeiro** (março 2026) — App Store `id6755496529`,
  Play `com.limblecmms.mobileApp`. Ficheiros `new-*`, `new-tablet-*`, `real-*`, `web-01`.
  **É esta o alvo.**
- **Legada** — App Store `id1108935725`, agora rotulada "Limble CMMS (Legacy)".
  Ficheiros `legacy-*`. Verde floresta, linhas apertadas, gaveta de hambúrguer.
  Aparece em quase todos os resultados de pesquisa. **Não é o alvo.**

Ficheiros de **pixels reais do produto**, sem moldura de marketing (os mais fiáveis para
julgar espaçamento e tamanho): `real-01` a `real-06`, `qr-01`, `qr-02`,
`legacy-17`, `legacy-18`.

## 6.2 Factos observáveis da app Limble nova

- **Paleta.** Navy quase preto no marketing (`~#0A0F2C`), verde lima ácido (`~#C8F135`)
  como acento de marca. **Mas o interior da app é claro**: cartões brancos sobre cinzento
  muito claro (`~#F7F8F9`). Botões primários em verde floresta (`~#1B7A3E`), não lima.
- **Cor semântica.** Prioridade e estado são **texto colorido**, não etiquetas cheias:
  `Critical` vermelho, `Medium priority` laranja, `Low priority` verde, `Open`/links azul
  (`~#1A73E8`). Contadores de notificação em círculo vermelho.
- **Linhas de lista.** Cartão por linha, ~4 cartões por ecrã, folgado.
  Cada cartão tem 4 linhas empilhadas:
  `tipo + #id` (pequeno, cinzento) → **título em negrito escuro** (o maior texto da linha)
  → linha do ativo com glifo de cubo cinzento → rodapé com prioridade à esquerda e estado à direita.
  Pilha de avatares (`+8`) no canto superior direito. Padding interno ~16px. Sem divisores pesados.
- **Ações primárias EM CIMA**, não em baixo: fila horizontal de pastilhas verdes logo
  debaixo do cabeçalho — `Scan QR`, `Create WO`, `Assets`, `Parts`, `Support`.
  **Não há botão de ação flutuante em sítio nenhum.**
- **Navegação:** 4 abas em baixo — `Home / Tasks / Assets / More`. Ícones de linha,
  rótulo debaixo do ícone, tinta verde no ativo.
  Ecrãs de detalhe: chevron para trás + título centrado + `⋯`, com barra de abas
  segmentada (sublinhado verde) por baixo.
- **Ícones.** Traço fino monoline ~1,5px, geométrico. Um ativo é **sempre um cubo de arame**,
  nunca uma foto.
- **Tipografia.** Uma sans geométrica. Hierarquia por **peso**, não por tamanho:
  títulos semibold a ~17–18px contra metadados regulares cinzentos a 13–14px.
  Números dos contadores muito grandes (~28px+) sobre um rótulo pequeno cinzento.
  Tudo em caixa de frase, sem maiúsculas.
- **Home** tem: barra de logo, fila de pastilhas verdes, cartão "Suggested tasks" com
  grelha 2×2 de contadores (`Recently created 18`, `Highest priority 5`, `Due today 4`,
  `Past due 1`), cartão "Bookmarked tasks", "My stats".
- **Tasks** tem: pesquisa, tira semanal horizontal (pastilha verde no dia selecionado,
  pontos nos dias com trabalho), depois `Tasks 4/29 · 2 due` e a lista de cartões.

## 6.3 Padrões do Limble que vale a pena copiar

- **Migalhas de localização** em quase todos os ecrãs: sítio → edifício → equipamento → filho.
  A hierarquia é uma ideia de navegação de primeira classe.
- Trabalho identificado sempre por **tipo + #número** (`Unplanned WO #125`, `Task #36`).
- Execução de instruções como **lista de passos numerados** com tipos de campo mistos
  (visto, dropdown, numérico, assinatura), temporizador e barra de percentagem.
- Ler **QR/código de barras** como porta de entrada de primeiro nível.

## 6.4 Onde o Limble é fraco — é aqui que temos de ganhar

- Os metadados dele estão a **13–14px**. O nosso corpo está a 18px.
- Os rótulos das abas dele são pequenos.
- Para criar uma ordem ele pede **cinco campos**: Task name, Priority, Task type,
  Due date, Start date. Nós gravamos **só com a descrição**.
- Ele assume ligação à rede. Nós somos **offline total** e dizemos-lho.
- O ecrã de peças dele (`legacy-17`, `legacy-06`) é um formulário web com a quantidade
  escondida num campo de texto. Nós pomos a quantidade em número grande com dois botões grandes.

## 6.5 Superfícies do Limble que não se conseguiram obter

- Uma **lista** de peças/inventário (só existe publicado o *detalhe* de peça e as
  *definições de limite*). Nos docs, a lista vive em More → Parts na app nova.
- Qualquer ecrã de peças, dashboards ou modo offline **da app nova**.
- Um leitor de QR **da app nova** (`qr-01` é o legado: câmara preta com visor branco).
- G2 / Capterra / GetApp devolveram HTTP 403.

---

# PARTE 7 — DECISÕES DO CLIENTE (não rediscutir)

Perguntadas e respondidas explicitamente.

## 7.1 Tema: CLARO por defeito

O tema preto com texto cinzento foi **rejeitado**. Ao sol não se lê.

```
--color-bg              #FFFFFF
fundo alternado         #F4F6F8    (o cinzento por trás dos cartões)
--color-card            #FFFFFF    com borda subtil e sombra suave
--color-text            #14181E
--color-text-secondary  #4A5560    (nunca mais claro do que isto para texto de leitura)
--color-border          #D8DEE4
azul MMCrespo           #0284c7    (ação primária, ligações)
verde MMCrespo          #059669    (concluído, ok)
âmbar                   #B45309    (atenção, pendente, offline)
vermelho                #C81E1E    (crítico, avariado, apagar)
```

Corpo **18px**. Títulos de cartão **22px**. Contadores **32px+**.
Peso faz a hierarquia, não o tamanho.
O escuro fica como **opção** nas definições, via `:root[data-theme="dark"]`,
respeitando `prefers-color-scheme` só quando o utilizador não escolheu.
**Nada de tipos de letra da internet.** Pilha do sistema.

## 7.2 Navegação: 4 abas + Mais

```
Barra inferior:  [ Hoje ]  [ Avarias ]  [ Tarefas ]  [ Mais ]
```

- Cada aba ≥ 48px de altura, rótulo ≥ 18px, rótulos de **uma palavra** para não truncarem em 390px.
- **Mais** abre uma lista de linhas grandes (≥ 64px): Ferramentas, Equipamento, Setores,
  Notas, Definições.
- A ação primária de registar avaria fica **em cima** (como o Limble novo),
  **sem botão flutuante**, e também dentro de cada sala e de cada equipamento.

## 7.3 Julgamos contra a app Limble **nova**, não a legada.

---

# PARTE 8 — O MÉTODO (construtor + crítico, em loop)

Foi isto que o cliente pediu e é o que dá a qualidade.

1. Partir o trabalho nas **peças mais pequenas que dão para melhorar e julgar sozinhas**.
2. Em cada peça, lançar **um construtor e um crítico separados, com contexto fresco**.
   O crítico não constrói nada e não deve lealdade a ninguém.
3. O crítico:
   - corre o medidor e produz **screenshots reais** a 390×844 (não julga código nem relatórios)
   - põe cada ecrã nosso ao lado do ecrã equivalente do Limble, **sem etiquetas**,
     sem saber qual é qual
   - responde a **uma** pergunta: *qual destes dois é melhor para o homem de 60 anos,
     de luvas, com uma mão, ao lado de uma máquina a fazer barulho?*
   - **empate conta como derrota** (temos de ser melhores, não iguais)
   - nomeia **o maior buraco que falta** — um só, o maior
   - verifica se o construtor mentiu, com o número real
   - verifica se o construtor **afrouxou o medidor** para passar o teste (é o pior que pode acontecer)
4. Volta ao construtor com o veredicto. **Loop até o crítico escolher o nosso cego.**
5. Elogios não contam para nada.

Pares de comparação usados:

| Par | Nosso | Limble |
|---|---|---|
| 1 ecrã inicial | `shots/01-home.png` | `new-01-home-quick-actions-suggested-tasks.png` |
| 2 lista de trabalho | `shots/02-ocorrencias.png` | `new-06-tasks-calendar-and-list.png` |
| 3 criar registo | `shots/05-nova-ocorrencia.png` | `new-04-create-work-order-from-qr-scan.png` + `legacy-03-start-work-request-form.png` |
| 4 equipamento | ecrã de equipamento | `real-04-asset-row-child-assets-breadcrumb.png` + `legacy-05-view-asset-detail.png` |
| 5 stock | ecrã de ferramentas | `legacy-17-part-detail-air-filter.png` |
| 6 tarefas | ecrã de tarefas | `new-06-tasks-calendar-and-list.png` |

Veredicto só pode ser GANHÁMOS se **≥ 5 dos 6 pares** forem nossos **E** o fluxo gravar em
**≤ 3 toques** **E** não houver defeitos visuais graves.

---

# PARTE 9 — O QUE FOI FEITO E CONFIRMADO POR MEDIÇÃO PRÓPRIA

## 9.1 P0 — Fundação visual  ✅ VERIFICADO

Ficheiros: `src/styles/theme.css`, `main.css`, `components.css`, `index.html`.

- **Escala tipográfica em tokens:** `--fs-nav:18px`, `--fs-label:18px`, `--fs-body:19px`,
  `--fs-body-lg:21px`, `--fs-title:24px`, `--fs-display:30px`, `--fs-kpi:34px`,
  `--lh-tight`, `--lh-body`.
  **Todos** os `font-size` em `rem` foram substituídos. Já não existe nenhum
  `font-size: 0.xxrem` no CSS. Onde a caixa alta a 18px não cabia em 390px,
  `text-transform: uppercase` passou a `none` (`.stat-label`, `.kpi-label`,
  `.priority-stat-title`, subtítulo do header).
- **Alvos de toque:** piso global `min-height: var(--min-touch)` e `min-width` nos botões.
  `.btn-del-mat` 8,4×16 → 48×48. `.btn-close-detail` 16,8×28,8 → 56×56.
  `.btn-mic-record` 40 → 56. `.mat-checkbox` 13×13 → 48×48 com `appearance:none`
  e marca de visto própria. Inputs a 56px. `--touch-gap: 8px` entre alvos vizinhos.
- **Barra inferior:** branco → `#0A0A0A`, altura 68 → 84px,
  `padding-bottom: env(safe-area-inset-bottom)`.
- **Google Fonts removido.** Pilha do sistema, coerente entre `main.css` e `theme.css`.
- **Tokens em falta definidos:** `--color-navy`, `--color-navy-header`,
  `--color-border-subtle`, `--color-gold-accent`, `--color-gold-light`, `--cta-height`.
  Zero `var(--…)` sem definição.
- **CSS dos toasts escrito de novo:** todas as classes que `toast.js` cria.
  Fundo sólido, texto 19px, barra de cor à esquerda de 8px, `z-index: 2000`
  (a barra inferior é 120), ancorado **acima** da barra. Confirmado por render real.
- **Contraste subido:** `--color-text` → `#FFFFFF`, `--color-text-secondary` → `#E8EEF5`,
  `--color-text-muted` → `#C4D0DD`. Pontos de estado 6–8px → 10–12px.
- **Cabeçalhos que não cabiam a 18px** passaram a duas linhas em vez de esmagar ou cortar.
- Fins de linha normalizados para LF (havia 230 linhas CRLF e 934 LF misturadas).
- Os `!important` necessários estão **num bloco único no fim de `components.css`**
  com cabeçalho a explicar que existem só por causa dos `style=""` inline no JS
  e que podem cair quando o JS for limpo.

**Resultado medido por mim, não relatado:**

| Critério | Antes | Depois |
|---|---|---|
| Alvos < 48px | 42 (menor 13px) | **0** |
| Texto < 18px | 154 (menor 10,4px) | **0** |
| Scroll horizontal | 0 | **0** nos 5 ecrãs |
| Erros de consola | 0 | **0** |

## 9.2 P1 — Camada de dados v4  ✅ VERIFICADO

`src/db/db.js`: acrescentado `this.version(4).stores({...})` **puramente aditivo** —
redeclara `reports`/`locations`/`materials`/`sync_queue` sem alterações e adiciona
`tasks`, `notes`, `tools`, `tool_moves`, `equipment`. As versões 1/2/3 ficaram intactas.
Sem upgrade handler destrutivo. Handles novos: `this.tasks`, `this.notes`, `this.tools`,
`this.tool_moves`, `this.equipment`.

### `src/db/tasksRepo.js`
Campos: `id, title, notes, dueDate, locationId, locationName, equipmentId, done(0|1),
doneAt, priority, recurring(null|'daily'|'weekly'|'monthly'), createdAt, updatedAt, synced, deleted`.
API: `getAll getById getForDate(iso) getToday() getTomorrow() getOverdue() create update
toggleDone(id) moveToTomorrow(id) remove markSynced`.
Helpers exportados: `toLocalDateISO() todayISO() tomorrowISO() nextRecurrenceDate()`.
**Dias de calendário em fuso local** (via `getFullYear/getMonth/getDate`, nunca
`toISOString()`), logo imunes a fuso.
`toggleDone(id)` devolve `{ task, nextTask }` e, se for recorrente, cria a próxima
ocorrência **na mesma transação**.
Índices: `dueDate`, `done`, `priority`, `[done+dueDate]`.

### `src/db/notesRepo.js`
Campos: `id, body, audioBlob, audioDuration, photoIds, locationId, locationName,
pinned(0|1), createdAt, updatedAt, synced, deleted`.
API: `getAll getById create update togglePinned remove search markSynced`.
`getAll()` ordena fixadas primeiro e depois mais recentes.
`search()` insensível a acentos e maiúsculas.
O `audioBlob` **não** é duplicado no payload da `sync_queue`.

### `src/db/toolsRepo.js`
`tools`: `id, name, unit('un'|'m'|'kg'|'L'|'cx'), qty, minQty, locationId, locationName,
notes, createdAt, updatedAt, synced, deleted`.
`tool_moves`: `++id, toolId, delta, qtyAfter, reason, reportId, at, synced`.
API: `getAll getById create update remove take(toolId, amount, reason, reportId)
restock(toolId, amount, reason) getLowStock() getMoves(toolId, limit) seedDefaults markSynced`.
`take()`/`restock()` partilham um método privado `#applyMove` que faz **ler-e-escrever
numa única transação `rw`** sobre `tools` + `tool_moves` + `sync_queue`.
Stock negativo lança `Error` com mensagem em português.
`DEFAULT_TOOLS` tem **25 itens reais de estádio**: os 5 nomes que já existiam em
`DEFAULT_MATERIALS` mais lâmpada de projetor LED 400W, driver de projetor, aspersor
retrátil, eletroválvula 24V, vedante PTFE, mangueira, cola PVC, disjuntor 16A,
diferencial 40A/30mA, cabo 3×2,5mm², terminais, multímetro, escova de relvado,
rede de baliza, semente, fertilizante, luvas, brocas, gasóleo.

### `src/db/equipmentRepo.js`
Campos: `id, name, category('iluminacao'|'rega'|'eletrico'|'agua'|'avac'|'seguranca'|
'desporto'|'outro'), locationId, locationName, brand, model, serial, installedAt,
warrantyUntil, status('ok'|'avariado'|'manutencao'|'abatido'), notes, createdAt,
updatedAt, synced, deleted`.
API: `getAll getById getByLocation(locId) getByCategory getBroken() create update
setStatus(id,status) remove search seedDefaults markSynced`.
Semeados **20+ equipamentos** reais e plausíveis, ligados aos IDs de localização
que já existiam (`LOC_EXT_LIGHTS`, `LOC_TECH_PUMPS`, `LOC_TECH_ELEC`,
`LOC_PITCH_IRRIGATION`, `LOC_EXT_GENERATOR`, …).

### `tests/unit/newRepos.test.js`
30 testes novos. Cobrem: migração v3→v4 sem perda de dados, fronteiras de dia locais em
`getToday`/`getTomorrow`, `toggleDone` e recorrência, `take()` a recusar stock negativo,
coerência entre `qty` e `tool_moves`, `getLowStock`, `equipment getByLocation`.

**Resultado medido por mim:** `npx vitest run` → **12 ficheiros, 114 testes, todos passam.**

## 9.3 Infraestrutura de acompanhamento criada

- **`maintenance_app/audit/measure.mjs`** — o medidor (Parte 3).
- **`maintenance_app/audit/BRIEF.md`** — o contrato de design que todos os agentes leem
  antes de mexer em nada. Evita deriva entre rondas de contexto fresco.
- **`maintenance_app/.limble-ref/`** — 39 imagens reais + `MANIFEST.md`.
- **`maintenance_app/audit/progresso.html`** — página de progresso, publicada em
  https://claude.ai/code/artifact/9c2db7ce-24a3-45cd-a924-41ac61d871aa
- **`C:\dev\estadio\RETOMAR.md`** — instruções curtas de retoma.
- **`.claude/launch.json`** — configuração para o browser interno se ligar ao dev server.
- Baselines guardados: `audit/baseline/`, `audit/pos-fundacao/`.

---

# PARTE 10 — O QUE ESTAVA A MEIO QUANDO OS CRÉDITOS ACABARAM

Uma ronda de **cinco agentes** ficou lançada em segundo plano.
**Verificar o que sobreviveu antes de repetir.**

Ela deveria produzir:

1. **Tema claro** — `src/styles/*.css`, inversão nos tokens (não nos componentes),
   escuro como `:root[data-theme="dark"]`, sombras e bordas refeitas para fundo branco,
   cartões com ar como o Limble, prioridade/estado como texto colorido.
2. **`src/ui/tasksView.js`** e **`src/ui/notesView.js`**
3. **`src/ui/toolsView.js`** e **`src/ui/equipmentView.js`**
4. **`src/main.js` + `src/ui/bottomNav.js` + `src/ui/quickCapture.js`** — navegação de
   4 abas, ecrã "Hoje" novo, captura de avaria em ≤3 toques, ligação dos ecrãs novos,
   correção de `setOnlineState`, limpeza dos `style=""` inline, apagar `stadiumMap.js`.
5. **Crítico cego** com as seis comparações par a par.

Como saber o que sobreviveu:

```bash
cd C:\dev\estadio\maintenance_app
ls src/ui/          # existem tasksView, notesView, toolsView, equipmentView, quickCapture?
ls audit/           # existe audit/critica/report.md?  o crítico correu?
node audit/measure.mjs --label retomar
npx vitest run
```

---

# PARTE 11 — O PLANO COMPLETO, PEÇA A PEÇA

Cada peça é pequena o suficiente para ser melhorada e julgada sozinha.

| # | Peça | Estado | Critério de aceitação |
|---|---|---|---|
| P0 | Fundação visual | ✅ feito | 0 alvos <48px, 0 texto <18px |
| P1 | Camada de dados v4 | ✅ feito | 114 testes passam |
| P2 | **Avaria em ≤3 toques** | a confirmar | medidor diz ≤3 **e** `(gravou)` |
| P3 | Tarefas hoje/amanhã | a confirmar | crítico escolhe o nosso no par 6 |
| P4 | Notas soltas | a confirmar | zero toques para começar a escrever |
| P5 | Stock de ferramentas | a confirmar | crítico escolhe o nosso no par 5 |
| P6 | Equipamento instalado | a confirmar | crítico escolhe o nosso no par 4 |
| P7 | Navegação e ecrã "Hoje" | a confirmar | crítico escolhe o nosso no par 1 |
| P8 | **Motor de sincronização** | **não começou** | fila drena, `synced` chega a 1 |
| P9 | Lista e ficha de detalhe | não começou | crítico escolhe o nosso no par 2 |

## P2 — A peça central: avaria em ≤3 toques

A conta do medidor é:
```
toque 1 = abrir a app (ícone no ecrã bloqueado)
toque 2 = "Registar avaria"
toque 3 = gravar
```
Ou seja, **entre abrir e gravar só há dois toques**. Logo:

- A folha abre com o **campo de descrição já focado** e o teclado a subir.
  Escrever não é um toque a mais se o campo já está focado.
- O botão de gravar é **enorme** (≥64px de altura, largura total), **fixo no fundo**,
  sempre visível sem scroll. Diz "Gravar avaria".
- **Só a descrição é obrigatória.**
  - local: se ele não escolher, grava com a **última localização usada**
    (guardada em `localStorage`) ou `'Estádio — local não indicado'`, editável depois.
    **Nunca bloquear o gravar por falta de local** — é o defeito B1.
  - prioridade: média por omissão, três pastilhas grandes, opcional.
  - data/hora: agora, automático, fora do caminho principal.
  - tempo gasto: **fora do caminho principal**, passa para a ficha ao resolver.
  - fotos, áudio, materiais: opcionais, atrás de botões grandes, nunca a bloquear.
- **Corrigir mesmo assim o seletor de local**, porque ele precisa dele: preencher a partir
  de `locationsRepo.getAll()`, filtrar enquanto se escreve, opções com ≥56px de altura,
  últimas usadas primeiro, um toque escolhe e fecha.
- Depois de gravar: fechar a folha, toast claro ("Avaria gravada no telemóvel"),
  a avaria aparece no topo da lista. Se offline, dizê-lo com honestidade.
- Manter o caminho que **já funciona**: "+ Avaria" dentro de uma sala pré-preenche o local.

## P3 — Tarefas (contrato de componente)

```js
export class TasksViewComponent {
  constructor(container, options = {})   // { onNewTaskForLocation, onOpenReport }
  async render()
  async refresh()
}
```
Ordem do ecrã: ação primária em cima ("+ Nova tarefa") → bloco de **atrasadas** em âmbar
se houver → secção "Hoje" com a data em português → secção "Amanhã" →
"Feitas hoje (N)" colapsado no fim.
Cada tarefa: alvo de **marcar feito com ≥56×56px** à esquerda (um toque, sem confirmação,
feedback imediato), título em negrito ≥21px, local por baixo, botão "Passar para amanhã" ≥48px.
"+ Nova tarefa" abre folha **mínima**: só o título e dois botões grandes "Hoje" e "Amanhã".
Resto atrás de "Mais detalhes". Gravar em 2 toques.

## P4 — Notas (contrato de componente)

```js
export class NotesViewComponent {
  constructor(container, options = {})   // { onConvertToReport, onConvertToTask }
  async render()
  async refresh()
}
```
Campo de escrita **sempre aberto** no topo, pronto a receber texto, com botão grande de
microfone ao lado. **Zero toques para começar a escrever.**
Usar `audioService` de `src/services/audioService.js` (já existe, copiar o padrão de
`startRecording`/`stopRecording` e o tratamento de erro de permissão que está em `main.js`).
Cada nota: corpo, data em português, leitor de áudio, fixar, apagar,
e duas ações ≥48px: **"Virar avaria"** e **"Virar tarefa"** (chamam os callbacks).

## P5 — Ferramentas (contrato de componente)

```js
export class ToolsViewComponent {
  constructor(container, options = {})   // { onNewReportForTool }
  async render()
  async refresh()
}
```
Aviso de **stock baixo** no topo em âmbar. Cada ferramenta é um cartão com o nome em negrito
≥21px e a **quantidade em número grande (≥34px, `--fs-kpi`)** com a unidade ao lado —
é o número que ele quer ver de longe, não escondido num campo.
**Dois botões grandes lado a lado, cada um ≥64px de altura**: `− Tirar 1` e `+ Repor 1`.
Um toque = um movimento. Atualizar o número no ecrã **imediatamente, sem re-renderizar a
lista toda** (não lhe tirar o sítio debaixo dos dedos enquanto ele carrega).
Para quantidades maiores, folha com teclado numérico grande — não obrigar a 5 toques para tirar 5.
Se `take()` lançar, mostrar toast de erro e **não mexer no número**.

## P6 — Equipamento (contrato de componente)

```js
export class EquipmentViewComponent {
  constructor(container, options = {})   // { onNewReportForEquipment, onViewEquipmentReports }
  async render()
  async refresh()
}
```
Bloco vermelho "Avariado (N)" no topo. Pesquisa + filtro por categoria em pastilhas ≥48px.
Lista **agrupada por localização**, com o local como cabeçalho de grupo (copiar a ideia das
migalhas do Limble, com o nosso tamanho de letra).
Cada equipamento: nome ≥21px, marca/modelo em secundário, **estado como texto colorido**
(ok verde, avariado vermelho, manutenção âmbar, abatido cinzento),
botão grande "Registar avaria", e "Ver avarias (N)" se houver.
Toque no cartão abre ficha com série, instalação, garantia (dizer em texto claro se já
passou ou não), notas, e botões de estado ≥48px.

## P7 — Navegação e ecrã "Hoje"

Barra: `[Hoje] [Avarias] [Tarefas] [Mais]`. **Tirar o botão flutuante** — o Limble novo
não tem, as ações primárias estão em cima.
Rotas: `hoje | avarias | tarefas | mais | ferramentas | equipamento | setores | notas | definicoes`.
Nos ecrãs de dentro de "Mais", a aba "Mais" fica ativa e há caminho de volta claro em cima
(chevron + título centrado, como o Limble em `real-01`).

Ecrã "Hoje", de cima para baixo:
1. Ação primária largura total: **"Registar avaria"**. Ao lado, ≥48px: "Nova tarefa".
2. Bloco de alerta se houver críticas abertas ou tarefas em atraso, com o número em grande.
3. "Tarefas de hoje" — as 3 primeiras + "Ver todas".
4. "Avarias abertas" — as 3 mais recentes/críticas + "Ver todas".
5. Tira de contadores grandes (número ≥34px, rótulo por baixo):
   abertas · críticas · em curso · feitas hoje.
   (padrão de `new-01`, a grelha 2×2 de "Suggested tasks")

O ecrã de **Métricas** sai da barra. Move-se para dentro de "Mais" ou fundem-se os
contadores úteis no "Hoje" e deixa-se cair o resto.

## P8 — Motor de sincronização (a maior dívida que resta)

Não existe nada. Construir:
- `src/services/connectivity.js` — estado online/offline, com listeners e um `subscribe()`.
- `src/services/syncQueue.js` — ler, ordenar por `timestamp`, marcar tentativas,
  `retryCount`, `lastError`, backoff exponencial, e **remover só depois de sucesso**.
- `src/services/syncEngine.js` — drenar a fila, respeitar **ordem de dependência**
  (uma localização nova tem de subir antes da avaria que a referencia),
  Last-Write-Wins por `updatedAt`, e marcar `synced: 1` no registo local.
- `src/services/cloud/cloudInterface.js` — a interface.
- `src/services/cloud/mockCloudProvider.js` — provider de mentira para desenvolvimento e testes.
- Corrigir **E1** (`setOnlineState` vs `updateStatus`).
- **Indicador de confiança honesto**: quantos registos estão à espera, e desde quando.
  Nunca dizer "Sincronizado" a uma coisa que não subiu.

## P9 — Lista de ocorrências e ficha de detalhe

Legibilidade a um metro, avançar estado com um toque, alcance de uma mão,
fluxo de resolver (é aqui que se pede o tempo gasto, não no registo).
Comparação cega contra `new-06` (lista) e `real-01` / `web-01` (detalhe).

## Peças extra que valem a pena (surgiram da leitura)

- **Comprimir as fotos no momento da captura** (defeito E5) — mover a lógica de canvas de
  `photoEditor.js` para um `photoService.js` que corre sempre, não só ao anotar.
- **Ler QR/código de barras** para saltar direto ao equipamento — é entrada de primeiro
  nível nas duas gerações do Limble, e para um homem de luvas é melhor que navegar 3 níveis.
- **Reescrever o `PROJECT.md`** a partir da realidade do disco (defeito E7).
- **Tirar os `!important`** de `components.css` depois de os `style=""` inline saírem do JS.

---

# PARTE 12 — REGRAS DE ENGENHARIA

- Vanilla JS, ES modules, sem frameworks, sem TypeScript. Vite. Dexie.
- **Manter os nomes de classe CSS existentes.** Muito código depende deles.
- Componentes seguem todos o mesmo padrão:
  ```js
  export class XComponent {
    constructor(container, options = {}) { ... }
    async render() { ... }
  }
  ```
  `src/ui/history.js` é o melhor exemplo a copiar (classe, `esc()`, `bindEvents`, `refresh`).
- **Escapar todo o texto do utilizador** antes de o meter em `innerHTML`.
  Copiar o `esc()` de `history.js`. Há corpo de nota livre a entrar no DOM.
- Toda a mutação escreve na `sync_queue` **na mesma transação** Dexie.
- `synced` e `deleted` são números `0|1` (são indexáveis), **nunca booleanos**.
- Datas em ISO 8601. **Dias de calendário no fuso local, nunca UTC.**
- Blobs pesados (`photos`, `audioBlob`) **não** vão no payload da `sync_queue`.
- Nada de estilos inline em `style=""` — é dívida, tirar quando se toca no ficheiro.
- Números alinhados em coluna usam `font-variant-numeric: tabular-nums`.
- Usar só `var(--color-*)` e os tokens `--fs-*` / `--min-touch`. Nunca cores literais.
- **Nenhuma cor pode ter a sua única definição dentro de um media query ou de
  `[data-theme]`** — todas nascem no `:root` simples, senão o tema por defeito fica sem ela.
- Antes de dizer que acabaste: `npx vitest run` **e** `node audit/measure.mjs`.
  Números reais ou nada.

---

# PARTE 13 — COMANDOS

```bash
cd C:\dev\estadio\maintenance_app

npm run dev                              # dev server em :5173
npx vitest run                           # 114 testes unitários
npx playwright test                      # E2E (tiers 1-4)
node audit/measure.mjs --label <nome>     # o medidor + screenshots

# ler o resultado
cat audit/<nome>/report.md
# e OLHAR para audit/<nome>/shots/*.png com uma ferramenta de leitura de imagem
```

---

# PARTE 14 — A COISA MAIS IMPORTANTE A NÃO PERDER

**Medir em vez de acreditar.**

O bloqueio B1 — a app não conseguia registar uma avaria pelo botão principal — não estava
em nenhum relatório, em nenhuma documentação, em nenhum teste. A suite de 114 testes passava
toda. O `PROJECT.md` dizia que o milestone estava feito.

Só apareceu porque o medidor tentou, com um browser a sério, clicar nos botões que um homem
de 60 anos clicaria, e depois **foi ver ao IndexedDB se alguma coisa ficou lá gravada**.

Todos os construtores e todos os críticos deste projeto têm de acabar o trabalho com o
medidor a correr e com os olhos nos screenshots. Um número que não veio do medidor não conta.
