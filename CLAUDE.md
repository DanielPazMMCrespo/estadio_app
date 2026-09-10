# CLAUDE.md — Estádio Municipal de Leiria · App de Manutenção

Guia de trabalho para agentes neste repositório. Tudo o que está aqui foi lido
do código real (não é plano nem intenção). Se o código mudar, atualiza este
ficheiro.

**Idioma**: o produto, os comentários, os commits e as mensagens de UI são em
**português de Portugal**. Nomes de variáveis/funções são em inglês (herdado).
Não traduzas comentários existentes — são decisões documentadas.

---

## 1. O que é isto

PWA (Progressive Web App = site que se instala como app) **offline-first** para
os técnicos de manutenção do Estádio Municipal de Leiria registarem no
telemóvel: intervenções/avarias com fotos, tarefas do dia, notas, stock de
ferramentas, equipamento instalado e as 464 portas do chaveiro. A entrada é
um perfil local com PIN de 4 dígitos (sem servidor, sem rede): identifica o
autor de cada avaria e evita uso acidental por outra pessoa.

Restrições reais que explicam quase todas as decisões do código:

- O técnico usa **luvas**, **ao sol**, **ao lado de máquinas com ruído**.
  → Toques ≥48px, texto mínimo 18px, vibração (haptics) como confirmação.
- A rede do estádio **falha** (caves, salas técnicas, balneários).
  → Tudo grava primeiro no telemóvel. Não haver rede é o caso NORMAL, não erro.
- **Perder uma avaria é o pior que pode acontecer.**
  → A fila de sincronização só apaga o que o servidor confirmou item a item.
- Vários técnicos usam a app e têm de ver o trabalho uns dos outros.
  → Sincronização ligada por defeito, sem passo manual.

---

## 2. Onde é que se trabalha

O código da app está em **`maintenance_app/`**, não na raiz. Quase todos os
comandos correm lá dentro.

```bash
cd C:\dev\estadio\maintenance_app
```

### Estrutura da raiz (`C:\dev\estadio`)

| Caminho | O que é |
|---|---|
| `maintenance_app/` | **a app** (Vite + JS puro + servidor Node) |
| `PROJECT.md` | plano inicial dos milestones M1–M6 — **desatualizado**, ver §12 |
| `HANDOFF.md` (42 KB) | histórico longo de entrega entre agentes |
| `RETOMAR.md` | resumo curto para retomar trabalho |
| `TEST_READY.md` | notas da suite de testes |
| `tarefas-qwen/` | 13 fichas de execução passo-a-passo + `REGRAS.md` (ver §11) |
| `.agents/` | artefactos de sessões de agentes antigas (ignorado pelo git) |
| `design-2026/` | 6 mockups `.dc.html` (Main, Estadio, Detalhe, MapaApp, NovaAvaria, Registos) |
| `generations/refs/` | imagens de referência |
| `*.pdf` | `REVISAO_APP_ESTADIO.pdf`, `PLANO_CONSENSO_ESTADIO.pdf` |
| `.env` | chaves de APIs de geração de imagem (KIE, FAL, WAVESPEED, GOOGLE). **Não** é usado pela app. Nunca escrever estes valores em ficheiros nem em respostas. |
| `package.json` | só faz proxy: `build` e `start` entram em `maintenance_app` |

### Ficheiros-lixo — não voltes a criá-los

Havia 19 ficheiros de 0 bytes com nomes como `0`, `1`, `x.r`, `resolve(null)`,
`{,`, `HTTP`, `$(grep`, `this.onViewAllReports('in_progress'))` e, dentro de
`public/icons/`, `1))`, `240)`, `25)`, `II'` e `ch`. Nasceram de comandos mal
escapados na consola. Foram todos apagados.

**Regra**: em `bash` usa heredoc; em PowerShell usa here-string `@'…'@`. Não
metas parênteses nem `>` soltos numa linha de comando. Se aparecer um ficheiro
de 0 bytes com nome estranho, foi assim que apareceu — apaga-o.

---

## 3. Comandos

Todos a partir de `maintenance_app/`.

Servidor de desenvolvimento (porta 5173):

```bash
npm run dev
```

Testes unitários — **têm de dar `175 passed`**:

```bash
npm test
```

Testes E2E (Playwright, Pixel 5 + iPhone 13):

```bash
npm run test:e2e
```

Guarda contra estilos inline no JavaScript (falha se piorar):

```bash
npm run verificar:estilos
```

Build de produção para `dist/`:

```bash
npm run build
```

Servidor de produção (serve `dist/` + API, porta `PORT` ou 3000):

```bash
npm start
```

Cópia de segurança da base partilhada (JSON datado em `backups/`, ignorado
pelo git — nunca commitar dumps):

```bash
API_URL=https://<host> SYNC_TOKEN=<token> node scripts/backup.mjs
```

Outros: `npm run test:watch`, `npm run preview`.

### Pré-visualizar no browser

Existe `.claude/launch.json` com a configuração `estadio-dev` (npm run dev,
porta 5173). Usa as ferramentas de Browser com `{name: "estadio-dev"}` — nunca
lances servidores pelo Bash.

Para a API funcionar em dev é preciso **dois** processos: `npm start` (backend
na 3000) e `npm run dev` (Vite na 5173, com proxy `/api` → 3000).

---

## 4. Stack

- **Vite 5** + **JavaScript ES2022 puro**. Sem React, sem TypeScript no `src/`,
  sem framework, sem router. Só os testes usam `.ts`.
- **Dexie 4** sobre IndexedDB = base de dados local no telemóvel.
- **Service Worker** próprio (`public/sw.js`) + `manifest.webmanifest`.
- **Servidor**: Node puro (`node:http`), zero Express. Única dependência de
  runtime: `pg` (PostgreSQL).
- **Fontes**: só do sistema. Nada vem da internet (app 100% offline).
- **Sem dependências novas.** A app não instala pacotes.

---

## 5. Mapa do código (`maintenance_app/src`, ~11 300 linhas)

### `db/` — dados locais

| Ficheiro | Conteúdo |
|---|---|
| `db.js` (380) | classe `EstadioMaintenanceDB` (Dexie), esquema v1→v4, helpers de fotos |
| `reportsRepo.js` (277) | intervenções/avarias |
| `tasksRepo.js` (379) | tarefas + datas + recorrência |
| `notesRepo.js` (221) | notas soltas |
| `toolsRepo.js` (388) | stock de ferramentas + movimentos |
| `equipmentRepo.js` (357) | equipamento instalado |
| `locationsRepo.js` (385) | hierarquia do estádio (7 setores, 33 salas) |
| `materialsRepo.js` (131) | materiais consumíveis |
| `doorsRepo.js` (417) | portas do estádio (o chaveiro: 464 portas) |

Cada repositório exporta a classe **e** uma instância única (`reportsRepo`,
`tasksRepo`, …). Todos aceitam `dbInstance` no construtor para os testes.
Todos escrevem na `sync_queue` a cada mutação.

### `services/`

| Ficheiro | O que faz |
|---|---|
| `syncEngine.js` (336) | motor de sincronização (ver §8) |
| `photoCompressor.js` (157) | comprime para 1600px / JPEG 0,75 (~300 KB). Nunca lança: se falhar devolve o original |
| `photoEditor.js` (299) | anotar fotos em canvas (setas, círculos, pincel) |
| `pdfService.js` (403) | relatórios em PDF, com rótulos de prioridade/estado |
| `speechService.js` (229) | ditado por voz (Web Speech API, pt-PT) |
| `profile.js` | perfil local (PIN com hash, nome do autor) — sem servidor |
| `audioService.js` (160) | memos de voz (MediaRecorder) |
| `haptics.js` (29) | vibração. Nunca lança (iOS não tem `navigator.vibrate`) |

### `ui/` — componentes de classe, sem framework

`header.js`, `bottomNav.js`, `homeView.js`, `history.js`, `tasksView.js` (752),
`toolsView.js` (526), `equipmentView.js` (464), `notesView.js`,
`reportsView.js`, `reportDetail.js`, `quickCapture.js`, `doorsView.js`, `lockScreen.js`
(perfil + PIN de entrada), `dashboard.js`
(métricas), `stadiumNavigator.js`, `stadiumMap.js`, `locationModal.js`,
`toast.js`.

Padrão: `new XComponent(container, options)` → `.render()`. Os callbacks vêm
sempre por `options` (`onSave`, `onNavigate`, `onSelect`, …).

### `utils/html.js`

`esc(value)` e `attr(value)` — **usa sempre estes** ao construir HTML com
`innerHTML`. `reportListHtml(rows)` desenha o histórico das fichas de
equipamento e porta (texto escapado, id em `data-attribute`).

### `main.js` (~1450) — o controlador

`class App` com `init()` → `initShell()` → `navigateTo(viewId)`.

Vistas: `home` (Hoje), `history` (Intervenções), `tasks`, `more`, `tools`,
`equipment`, `doors`, `reports`, `notes`, `sectors`, `settings`, `metrics`.

Barra inferior: **Hoje · Intervenções · Tarefas · Mais** (+ botão central de
nova intervenção). O menu "Mais" abre: Relatórios, Métricas, Ferramentas e
Stock, Equipamento Instalado, Portas, Áreas do Estádio, Notas Soltas,
Definições.

### `styles/`

Ordem de carregamento, tal como está no `index.html`:

`main.css` (reset) → `theme.css` (tokens) → `components.css` →
`views-tasks-notes.css` → `views-tools-equipment.css` → `views-more.css` →
`views-estadio.css` → `views-portas.css` → `quadrados.css`.

Os `views-*` carregam depois do `components.css`, por isso ganham empates de
especificidade. Um ficheiro por área para vários autores não se atropelarem.

`quadrados.css` é o último e é partilhado: as classes `.ht-*` (grelha, caixa,
número no canto) servem a página principal, o menu "Mais" e o ecrã "Estádio".
Mexer lá mexe nos três ecrãs.

---

## 6. Base de dados local (Dexie, `EstadioMaintenanceDB`)

Esquema atual: **versão 5**. Ao adicionar uma tabela, **cria uma versão nova e
volta a declarar as tabelas antigas sem alterações** — é assim que o Dexie
mantém os dados do técnico.

| Tabela | Índices |
|---|---|
| `reports` | `id, date, locationId, locationName, priority, status, sectorCode, createdAt, updatedAt, synced, deleted` |
| `locations` | `id, name, isCustom, createdAt, synced` |
| `materials` | `id, name, createdAt, synced` |
| `tasks` | `id, dueDate, locationId, equipmentId, done, priority, recurring, createdAt, updatedAt, synced, deleted, [done+dueDate]` |
| `notes` | `id, pinned, locationId, createdAt, updatedAt, synced, deleted` |
| `tools` | `id, name, locationId, qty, minQty, createdAt, updatedAt, synced, deleted` |
| `tool_moves` | `++id, toolId, reportId, at, synced` |
| `equipment` | `id, name, category, locationId, status, serial, createdAt, updatedAt, synced, deleted` |
| `doors` | `id, numero, numeroAntigo, lado, piso, tipo, sectorId, status, createdAt, updatedAt, synced, deleted` |
| `sync_queue` | `++id, entityType, entityId, action, timestamp, retryCount` |

Convenções em todas as tabelas:

- `id`: UUID v4 (com fallback manual — `crypto.randomUUID` não existe em todos
  os ambientes de teste).
- `synced`: `0` = local, `1` = confirmado pelo servidor.
- `deleted`: `0`/`1`. **Apagar é sempre suave** (soft delete) — só
  `reportsRepo.hardDelete()` apaga a sério.
- Datas em ISO 8601. `tasks.dueDate` é data local `YYYY-MM-DD`
  (`toLocalDateISO`, `todayISO`, `tomorrowISO`).

### Valores fixos

- `reports.priority` / `tasks.priority`: `critical` | `medium` | `low`
- `reports.status`: `pending` | `in_progress` | `resolved`
  (passar a `resolved` grava `resolvedAt`)
- `equipment.status`: `ok` | `avariado` | `manutencao` | `abatido`
- `tools` unidades: `un` | `m` | `kg` | `L` | `cx`
- `tasks.recurring`: `null` | `daily` | `weekly` | `monthly`
- `doors.status`: `ok` | `avariado` | `manutencao` | `abatido` (os mesmos do
  equipamento de propósito — o técnico já conhece as palavras)
- `doors.lado`: `nascente` | `poente` | `sul` (**não há norte no chaveiro**)
- `doors.piso`: `-1` a `4`
- `doors.tipo`: `tecnica` | `wc` | `arrecadacao` | `passagem` | `persiana` |
  `camarote` | `posto_medico` | `gabinete` | `desportiva` | `bar` | `geral`

### Fotos — a parte delicada

Um `Blob` **não sobrevive** ao clone estruturado do `fake-indexeddb` usado nos
testes. Por isso `db.js` normaliza tudo para `Uint8Array` (hooks
`creating`/`updating` na tabela `reports`) e oferece leitores tolerantes:

- `normalizePhotoItemSync` / `normalizePhotoItemAsync` / `normalizePhotosAsync`
- `getPhotoBlob(photo)` — aceita Blob, ArrayBuffer, TypedArray, objeto
  indexado, dataURL ou base64 solto
- `getPhotoDataUrl(photo)` — para enviar ao servidor e para o PDF
- `getPhotoArrayBuffer(photo)`

Não escrevas `photo.blobData` diretamente num `<img>`. Usa os leitores.

### Locais do estádio

`STADIUM_HIERARCHY` em `locationsRepo.js`: 7 setores × salas = 33 locais
semeados no arranque.

| Setor | `id` | `code` |
|---|---|---|
| Bancada Poente (Principal & VIP) | `SEC_POENTE` | `LOC_WEST_STAND` |
| Bancada Nascente | `SEC_NASCENTE` | `LOC_EAST_STAND` |
| Topo Norte | `SEC_NORTH` | `LOC_NORTH_STAND` |
| Topo Sul | `SEC_SOUTH` | `LOC_SOUTH_STAND` |
| Relvado & Pista de Atletismo | `SEC_PITCH` | `LOC_PITCH` |
| Balneários & Zonas Técnicas | `SEC_TECH` | `LOC_CHANGING` |
| Exterior, Portões & Apoio | `SEC_EXTERIOR` | `LOC_EXTERIOR` |

`PREDEFINED_LOCATION_IDS` fixa os IDs que os testes E2E e a cloud esperam.
**Não renomeies estes IDs.** O técnico pode criar locais novos offline
(`isCustom: true`).

### Portas (o chaveiro)

As 464 portas vêm de `Chaveiro.xlsx` e vivem em `src/data/portas.js`
(`DEFAULT_DOORS`). **Ficheiro gerado — não editar à mão**: corrigir o Excel e
voltar a gerar.

- `id` é fixo (`DOOR_<numero>`) e **não** é UUID. As portas são as mesmas em
  todos os telemóveis; um UUID por telemóvel criava 464 duplicados por técnico
  ao sincronizar.
- `numero` é único (1 a 577, com saltos e sufixos como `13a`). `numeroAntigo`
  é o número de chave antigo (50 portas não o têm) — os técnicos com mais anos
  de casa ainda procuram por ele, por isso a pesquisa aceita os dois.
- `areaOriginal` guarda o texto tal como estava no Excel. `tipo` é a versão
  normalizada usada nos filtros. No Excel havia `BAR` e `Bar`: foram juntos.
  As 198 portas sem Área ficaram em `tipo: 'geral'`.
- Distribuição: nascente 211, poente 190, sul 63.
- `compareDoorNumbers()` ordena como uma pessoa: a 9 antes da 10, a `13a` logo
  a seguir à 13. Ordenar por texto punha a 10 antes da 9.

O ecrã (`doorsView.js`) abre com filtros de Lado, Piso e Tipo porque uma lista
corrida de 464 linhas não se usa no telemóvel. A etiqueta de estado só aparece
quando a porta **não** está em serviço.

---

## 7. Servidor e API

`server.js` (Node `http` puro) serve `dist/` + 3 rotas. `server/db.js` trata do
PostgreSQL.

| Rota | Método | O que faz |
|---|---|---|
| `/api/health` | GET | `{status, database: 'connected'\|'offline_mode', timestamp}` — aberto de propósito (sondas) |
| `/api/sync/push` | POST | recebe `{mutations: [...max 500]}`, devolve `{success, processedCount, processedIds, unprocessedCount, unprocessedIds}` |
| `/api/sync/pull?since=<ts>` | GET | devolve `{timestamp, hasMore, reports, tasks, notes, tools, equipment, locations, doors, materials}` — lotes de 1000 por tabela |

Detalhes que importam:

- Sem `DATABASE_URL`, o servidor **arranca mesmo assim** em modo PWA local; as
  rotas de sync devolvem **503**. Isto é comportamento correto.
- Autenticação: com `SYNC_TOKEN` definido, push/pull exigem
  `Authorization: Bearer <token>` (comparação em tempo constante) e devolvem
  **401** sem ele. Sem `SYNC_TOKEN`, fica aberto como antes (desenvolvimento)
  e avisa no arranque. O cliente envia o token de `VITE_SYNC_TOKEN` (build) ou
  `localStorage['sync.token']` (por aparelho); 401 se vê como aviso, nunca
  como erro — a app continua a gravar local.
- `CORS_ORIGIN` restringe a origem (por omissão `*`, desenvolvimento).
  Rate-limit artesanal: 120 pedidos `/api`/min por IP → **429**.
- `initDatabase()` cria as tabelas e índices com `CREATE TABLE IF NOT EXISTS` a
  cada arranque, mais `ADD COLUMN IF NOT EXISTS` para as colunas do sync
  (`reports.equipment_id/door_id/resolved_at/resolution_notes`,
  `tools.unit/location_name/notes`, `equipment.brand/model/location_name/notes/installed_at/warranty_until`,
  `notes.location_name/photo_ids/audio_duration`,
  `tool_moves.client_ref/reason/qty_after`) e `qty/min_qty/delta` em NUMERIC
  (o cliente usa decimais em m/kg/L). Tabelas PostgreSQL em **snake_case**; a
  conversão para camelCase é feita no `getSyncPull`.
- `processSyncPush` corre numa transação (`BEGIN`/`COMMIT`/`ROLLBACK`) com
  UPSERT genérico por entidade (`PUSH_ENTITIES`): **UPDATE parcial só toca nas
  colunas que o payload traz** — um toggle de estado nunca apaga nome/descrição.
  `updated_at` é cortado pelo relógio do servidor (`clampUpdatedAt`: aceita o
  passado do offline, corta o futuro). `tool_move` é ledger append-only
  idempotente por `client_ref` (id do item na fila) e atualiza `tools.qty`;
  `material` tem ramo próprio. Entidade desconhecida ou sem `entityId` **nunca
  é confirmada**: fica na fila e sai em `unprocessedIds`.
- `getSyncPull` pagina (1000/tabela, cursor = maior `updated_at` do lote,
  `hasMore` para o lote seguinte). `tool_moves` **não** entra no pull de
  propósito: os ids locais `++id` colidiriam com os SERIAL do servidor.
- Corpo medido em **bytes** (não UTF-16): excesso → **413** com resposta (antes
  pendurava a ligação). `%` malformado → **400**. `since` inválido → **400**.
  Erros 500 são genéricos; o detalhe fica no log do servidor.
- HTML servido com CSP (`script-src 'self'` — o failsafe do splash é ficheiro
  externo, `public/splash-failsafe.js`, por isso não há inline), mais
  `X-Frame-Options: DENY`, `nosniff` e `Referrer-Policy`. Estáticos: `sw.js`
  com `no-store`; `/assets/*` com `max-age=31536000, immutable`; o resto
  1 hora. Fallback SPA para caminhos sem extensão.
- Proteção de path traversal: recusa caminhos fora de `dist/`.

### Deploy (Railway)

`Dockerfile` multi-stage: `node:20-alpine` → `npm ci` → `npm run build` →
imagem final com `npm ci --omit=dev`, `dist/`, `server.js` e a pasta `server/`.
Porta 3000.

A linha `COPY server ./server` é obrigatória: o `server.js` faz
`import './server/db.js'`, e sem ela a imagem final arranca e rebenta logo.
Não a apagues.

---

## 8. Motor de sincronização (`syncEngine.js`)

Regra de ouro: **não haver rede, servidor ou backend é o caso normal**. Nada
disso grita na consola nem chega aos olhos do técnico.

Ciclo:

1. `init()` — ouve `online`/`offline`, timer de **30 s**, primeira tentativa 2 s
   após arranque.
2. Sonda `/api/health` antes de mexer na fila.
3. **PUSH**: drena a `sync_queue` em lotes de 100 (`PUSH_CHUNK_SIZE`; o servidor
   recusa acima de 500). Se um lote falhar, apaga só o confirmado antes da
   falha — **a fila nunca se apaga por inteiro sem confirmação**. Marcar
   (`synced: 1`) e apagar correm **na mesma transação Dexie** (`markConfirmed`).
   `SYNCED_TABLES` inclui `tool_move`/`material`; a chave de `tool_moves` é
   convertida para número (viaja como string e falhava em silêncio).
4. **PULL**: cursor `?since=` guardado em `localStorage['last_sync_timestamp']`,
   em loop enquanto `hasMore` (trava de 50 lotes); o cursor avança e grava por
   lote, por isso cair a meio retoma em vez de recomeçar. Faz `table.put(row)`
   em cada tabela (`reports`, `tasks`, `notes`, `tools`, `equipment`, `doors`,
   `locations`, `materials`). Quota cheia a meio do pull para com aviso
   honesto em vez de fingir que correu.
5. Falhas → backoff crescente: **1 min → 5 min → 15 min → 30 min**. Voltar a ter
   rede limpa o backoff.

`request()` nunca lança e **verifica o `content-type` antes do `JSON.parse`** —
sem isto o `index.html` do Vite (`<!DOCTYPE`) rebentava o parser. Envia
`Authorization` nos pedidos de sync quando há token configurado; 401 aparece
como aviso na consola, não como erro.

Desligar a sync só para testes:
`localStorage.setItem('sync.backend.enabled','0')` ou `VITE_SYNC_ENABLED=false`.

`pendingInfo()` (conta + idade da mais antiga + último sync) alimenta o cartão
de sincronização das Definições — é o que distingue "offline há 1h" de
"backend em baixo há 3 semanas".

Estados notificados aos listeners: `idle` | `syncing` | `synced` | `offline` |
`error`.

### Captura de avaria (o caminho rápido)
O botão verde abre a **captura rápida** (`quickCapture.js`): descrição, foto
(comprimida no momento), local e prioridade — ≤3 toques. "Mais campos" leva o
já escrito para o formulário completo (`openFullNewReport`). Contexto
estruturado viaja junto: `equipmentId/equipmentName`, `doorId/doorNumero`, ou
desconto de stock (`toolId` + quantidade, descontado **depois** de gravar —
a avaria nunca se perde por falta de stock). O ditado avisa sem rede (é
transcrição na nuvem) em vez de ficar mudo.

### Entrada com PIN (perfil local)

Sem contas no servidor: à primeira abertura, nome + PIN de 4 dígitos
(`lockScreen.js`, `services/profile.js`); depois, só o PIN. O PIN nunca é
guardado em claro (hash SHA-256) e tudo funciona sem rede. Cada intervenção
nasce assinada (`reports.author`, imutável, sincronizado e visível na ficha).
Definições tem "Bloquear agora" e "Trocar de utilizador" (apaga o perfil, os
dados ficam; recarrega para o setup). Quem já usava a app vê o nome antigo
(`operator_name`) já preenchido.

---

## 9. Design system (`src/styles/theme.css`)

**Regra de ouro do ficheiro**: toda a cor NASCE no `:root` simples. Nenhuma cor
tem a sua única definição dentro de um `@media` ou `[data-theme]`. Ordem
obrigatória dos blocos:

1. `:root` → tema **claro** (defeito)
2. `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`
3. `:root[data-theme="dark"]` → escolha explícita ganha

### Cores

| Token | Valor | Uso |
|---|---|---|
| `--color-brand-primary` | `#557D14` | verde do logotipo mmcrespo, ação primária |
| `--color-brand-primary-hover` | `#4E7215` | o mesmo, mais escuro |
| `--color-brand-text` | `#4E7215` | a mesma cor, legível sobre branco (5,6:1) |
| `--color-stadium-green` / `--color-success` | `#059669` | concluído |
| `--color-gold` | `#B45309` | âmbar: atenção, pendente, offline |
| `--color-danger` | `#C81E1E` | crítico, avariado, apagar |
| `--color-bg` / `--color-card` | `#FFFFFF` | cabeçalho, cartões |
| `--color-bg-alt` | `#F4F6F8` | cinzento por trás dos cartões |
| `--color-text` | `#14181E` | texto |
| `--color-text-secondary/muted` | `#4A5560` | **o mais claro permitido** |

Cada cor semântica tem par: o **cheio** (fundo sólido, texto branco) e o de
**texto** (escurecido, contraste ≥4.5:1). Tintas de estado calmas:
`--tint-blue/green/amber/red/neutral`. Cores de setor `--sec-*`: só o glifo é
colorido, a caixa fica neutra.

O navy `#0B132B` e o dourado `#C5A059` do `PROJECT.md` **já não são a paleta
ativa** — sobrevivem só no `manifest.webmanifest`.

### Tipografia — em px de propósito

`--fs-nav: 18px` · `--fs-label: 18px` (mínimo absoluto) · `--fs-body: 19px` ·
`--fs-body-lg: 21px` · `--fs-title: 24px` · `--fs-display: 30px` ·
`--fs-kpi: 34px`. `--lh-tight: 1.25`, `--lh-body: 1.5`.

**Nunca escrevas texto de leitura abaixo de 18px.** `rem` já derrapou uma vez
para 10–14px; por isso é px.

### Geometria e sombras

Raios 6/8/10/14px (`--radius-card: 12px`). Sombras em cinzento-azulado muito
diluído — `rgba(0,0,0,.35)` suja o branco e foi retirado. `--shadow-focus-ring`
para foco de teclado.

### Acessibilidade — não desfazer

- **Zoom do utilizador está LIGADO** de propósito (WCAG 1.4.4). O técnico
  precisa de ampliar etiquetas e números de série. Não metas
  `maximum-scale=1` nem `user-scalable=no`.
- Toques ≥48px (classe `.touch-target`), CTA fixo de 56px.
- Cabeçalho **sem `backdrop-filter`** (custava performance); usa
  `--color-header-bg` a 97% de opacidade.
- `aria-label`, `aria-current`, `aria-live="polite"` nos toasts.

---

## 10. Testes

**17 ficheiros, 175 testes, todos a passar.** Duração ~13 s.

`tests/unit/` (Vitest + jsdom + `fake-indexeddb`, via `tests/helpers/setup.js`):
`db.test.js`, `db_stress.test.js`, `locationsRepo.test.js`, `newRepos.test.js`
(30), `photoCompressor.test.js`, `speechService.test.js`, `header.test.js`,
`htmlUtils.test.js`, `pwa.test.js`, `toast.test.js`, `field_tools.test.js`,
`pdfService.test.js`, `pdfWriter.test.js`, e as suites `challenger_*` /
`m2_challenger_stress` (volume: 1000 relatórios, 500 locais, 1000 itens de fila).

`field_tools.test.js` importa `src/ui/stadiumMap.js`. **Nenhum ecrã da app
importa esse componente** — está lá só para o teste. Não o apagues sem tratar
primeiro do teste.

`tests/e2e/` (Playwright): `tier1-features`, `tier2-boundaries`,
`tier3-interactions`, `tier4-stadium-scenarios`. `workers: 1` (o IndexedDB
tranca com paralelismo), Pixel 5 (393×851) e iPhone 13 (390×844).

> **E2E obsoleto (2026-09-10, medido):** os specs clicam em `#btn-new-report`,
> que já não existe na app (a captura é `#btn-hero-report` → folha rápida).
> T1.10–T1.14 falham por timeout de seletor; T1.15 (badge offline) passa. Os
> specs precisam de ser reescritos para a UI atual — e `tests/` não se mexe
> sem decisão explícita (§11.3). Não correr `test:e2e` à espera de verde.

Há duas configurações de teste (`vitest.config.ts` e o bloco `test` do
`vite.config.js`) — quase iguais; a do `vitest.config.ts` também aceita `.ts`.

---

## 11. Regras de trabalho neste repo

Do `tarefas-qwen/REGRAS.md`, e valem em geral:

1. `npm test` no fim de **qualquer** alteração. Tem de dar `175 passed`. Se der
   menos: `git checkout .` e reporta o bloqueio.
2. **Não instales pacotes.** Não mexas no `package.json`.
3. **Não mexas em `tests/`** para fazer um teste passar.
4. **Não apagues comentários em português** — são decisões documentadas.
5. Não mudes de branch nem faças `push` sem pedido. Sem `--amend`.
6. Um assunto por commit. Mensagens em português, minúsculas, prefixo
   `fix:` / `feat:` / `refactor:` / `perf:` / `chore:` / `docs:` / `style:`.
7. Não metas `style="…"` novo no JavaScript — corre
   `npm run verificar:estilos` (limites: 271 `style="`, 110 `font-size`).
8. Branch principal: `main`.

---

## 12. Estado atual (2026-09-10)

-_sync sem perdas_: push parcial seguro (só toca colunas trazidas),
  `updatedAt` cortado pelo servidor, `tool_move`/`material` nos dois sentidos,
  pull paginado com cursor, push em lotes de 100, transação atómica
  marcar+apagar, quota cheia com aviso honesto.
- _Turno_: captura rápida com foto (botão verde), contexto estruturado
  (equipamento/porta/stock), históricos nas fichas, "A seguir" abre a ficha,
  notas→intervenção/tarefa, recorrências criáveis, ditado honesto sem rede.
- _Entrada_: perfil local com PIN (sem servidor), avarias assinadas.
- _Segurança_: token opcional (`SYNC_TOKEN`/`VITE_SYNC_TOKEN`), rate-limit,
  limites de corpo em bytes, CSP, SW sem `/api`, XSS fail-closed nas fotos,
  `esc()`/whitelists, sourcemaps só em dev.
- _Ops_: CI (`.github/workflows/ci.yml`), `scripts/backup.mjs`, cartão de
  sincronização nas Definições.
- Verificado: `npm test` **175 passed**, `verificar:estilos` OK, harness de
  sync 20/20, servidor ao vivo 11/11, `npm run build` OK (sem sourcemaps),
  `npm audit --omit=dev` 0 vulnerabilidades.
- Funcional e testado (herdado): base de dados local v5, 7 setores/33 locais,
  as 464 portas do chaveiro, CRUD de intervenções com fotos, tarefas, notas,
  ferramentas com movimentos de stock, equipamento, PDF, memos de voz,
  métricas, Service Worker com Network-First na casca da app.
- As 13 fichas de `tarefas-qwen/` estão **todas executadas**.
- **`PROJECT.md` está desatualizado.** Descreve `services/cloud/` com
  `MockCloudProvider`/`FirebaseCloudProvider`, `reportForm.js`,
  `reportDetailModal.js`, `reportList.js`, `connectivity.js`, `syncQueue.js`,
  `sw.js` na raiz. **Nada disso existe.** O caminho real foi Node + PostgreSQL,
  `syncEngine.js` sozinho e `public/sw.js`. Lê o código, não o `PROJECT.md`.

### Pendentes conhecidos

1. ~~`public/icons/` tem 13 variantes~~ **Resolvido (2026-09-10):** ficam 6
   ficheiros canónicos (`apple-touch-icon`, `icon-192/512`, `logo-mmcrespo`,
   `mmcrespo-header/-white`). Os 12 órfãos (~0,5 MB) foram apagados; testes
   que prendem `icon-192/512` continuam verdes.
2. `design-2026/` tem 6 mockups ainda não aplicados à app.
3. **Revisão de design 2026 — feita.** Ver `REVISAO-DESIGN-2026.md` e
   `FASE1-MEDICOES.md` na raiz. O ecrã "Hoje" passou a "quadrados vivos": cada
   quadrado diz o seu número e a cor muda com o estado (vermelho só com
   críticas, âmbar com trabalho aberto, branco quando está tudo em ordem).
   Acima da grelha há a linha "A seguir", com a coisa mais urgente e um botão
   de 48px para marcar a tarefa feita. Tocar num quadrado abre a lista já
   filtrada. Os 11 passos do plano estão feitos.
   **Não voltes a pôr rótulos sem número nesta página**: media-se 52% do
   primeiro ecrã gasto em botões e zero dados à vista.
4. `src/ui/stadiumMap.js` não é importado por nenhum ecrã, só pelo teste
   `field_tools.test.js`. Ver §10. Fica assim de propósito (§11.3 proíbe
   mexer em `tests/` para apagar código).
5. `src/main.js` concentra a maior parte dos `style="` inline — ver
   `npm run verificar:estilos` (o `esc()` local já foi centralizado no
   `utils/html.js`; o resto é dívida visível, não escondida).
6. Por fazer (precisa de gente, não de código): piloto no terreno com 2
   técnicos (protocolo: 3 avarias com foto + 2 tarefas + 1 movimento em modo
   avião, medir toques e erros de luva); teste contra PG de staging;
   definir `SYNC_TOKEN`; reescrever os specs E2E para a UI atual.
