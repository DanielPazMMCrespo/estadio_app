# Como retomar este trabalho

Cola isto numa sessão nova, dentro de `C:\dev\estadio`:

> Continua o trabalho na app de manutenção do Estádio de Leiria.
> Lê `maintenance_app/audit/BRIEF.md` e `RETOMAR.md` primeiro.
> Retoma na peça onde ficou.

---

## Onde os agentes vão buscar o contexto

| Ficheiro | O que tem |
|---|---|
| `maintenance_app/audit/BRIEF.md` | **O contrato.** Utilizador, a barra medida, decisões do cliente, o que está errado, regras de engenharia. É o ficheiro mais importante. |
| `maintenance_app/.limble-ref/MANIFEST.md` | As 39 imagens reais do Limble e o que cada uma mostra. Atenção: há duas apps Limble, julgamos contra a **nova** (março 2026). |
| `maintenance_app/audit/measure.mjs` | O medidor. `node audit/measure.mjs --label <nome>` a partir de `maintenance_app/`. |
| `maintenance_app/audit/progresso.html` | A página de progresso. Republicar com a ferramenta Artifact para o mesmo URL. |

Página de progresso publicada:
https://claude.ai/code/artifact/9c2db7ce-24a3-45cd-a924-41ac61d871aa

---

## Decisões já tomadas pelo cliente (não rediscutir)

1. **Tema claro por defeito.** Fundo branco, texto `#14181E`, azul MMCrespo `#0284c7`.
   Corpo 18px, títulos 22px. O escuro fica como opção.
2. **Quatro abas mais Mais:** `Hoje · Avarias · Tarefas · Mais`.
   Ferramentas, equipamento, setores, notas e definições vivem dentro de Mais.
3. **Julgamos contra a app Limble nova**, não a legada.

---

## O método, para não se perder

Cada peça leva **um construtor e um crítico separados, com contexto fresco**.

O crítico:
1. Corre o medidor e produz screenshots reais a 390×844.
2. Põe cada ecrã nosso ao lado do ecrã equivalente do Limble, **sem etiquetas**.
3. Responde a uma pergunta: qual é melhor para o homem de 60 anos, de luvas, com uma mão,
   ao lado de uma máquina a fazer barulho?
4. Nomeia **o maior buraco que falta**. Um só.
5. **Empate conta como derrota.** Elogios não contam. Se o nosso não ganhar, volta ao construtor.

Só se passa à peça seguinte quando o crítico escolhe o nosso cego.

---

## Estado, medido e verificado

| Critério | Início | Agora |
|---|---|---|
| Alvos de toque abaixo de 48px | 42 | **0** |
| Texto abaixo de 18px | 154 | **0** |
| Testes unitários | 114 | **114 passam** |
| Toques até a avaria gravar | 6, e não gravava | **por confirmar** |

### Feito e confirmado por medição própria

- **P0 fundação visual.** Escala tipográfica em tokens, alvos de 48px, barra inferior corrigida,
  Google Fonts removido (quebrava o offline), tokens em falta definidos, CSS dos toasts escrito.
- **P1 camada de dados v4.** `tasksRepo`, `notesRepo`, `toolsRepo`, `equipmentRepo`.
  Schema v4 aditivo, migração segura. 30 testes novos. Dias de calendário em fuso local.
  25 ferramentas e 20+ equipamentos semeados, ligados às localizações reais do estádio.

### A meio quando os créditos acabaram

Uma ronda de cinco agentes ficou a correr em segundo plano. **Verificar se chegou ao fim
antes de a repetir.** Ela deveria ter feito:

1. Tema claro (`src/styles/*.css`)
2. `src/ui/tasksView.js` e `src/ui/notesView.js`
3. `src/ui/toolsView.js` e `src/ui/equipmentView.js`
4. `src/main.js` + `src/ui/bottomNav.js` + `src/ui/quickCapture.js` — navegação de 4 abas,
   ecrã "Hoje" novo, e a captura de avaria em ≤3 toques
5. Crítico cego com seis comparações par a par

**Como saber o que sobreviveu:**

```bash
cd /c/dev/estadio/maintenance_app && ls src/ui/ && git status 2>/dev/null; ls audit/
```

Se existirem `tasksView.js`, `notesView.js`, `toolsView.js`, `equipmentView.js` e
`quickCapture.js`, a ronda avançou. Se existir `audit/critica/report.md`, o crítico correu.

Depois, sempre, medir em vez de acreditar:

```bash
cd /c/dev/estadio/maintenance_app && node audit/measure.mjs --label retomar && npx vitest run
```

---

## Peças que faltam

| Peça | Estado |
|---|---|
| P2 registo de avaria em ≤3 toques | a confirmar — **é a peça central** |
| P3 tarefas hoje/amanhã | ecrã a confirmar |
| P4 notas soltas | ecrã a confirmar |
| P5 stock de ferramentas | ecrã a confirmar |
| P6 equipamento instalado | ecrã a confirmar |
| P7 navegação e ecrã "Hoje" | a confirmar |
| **P8 motor de sincronização** | **não começou** |
| P9 lista e ficha de detalhe | não começou |

### P8 é a maior dívida que resta

Não existe motor de sincronização. Os ficheiros que o `PROJECT.md` lista
(`syncEngine.js`, `syncQueue.js`, `connectivity.js`, `cloud/*`) **não estão no disco**.
A `sync_queue` cresce para sempre e nunca é drenada. Cada avaria, tarefa, nota e movimento
de ferramenta escreve lá uma linha que ninguém lê.

---

## Defeitos conhecidos ainda não resolvidos

- `main.js` chama `header.setOnlineState()`. O componente só tem `updateStatus()`.
  O estado online/offline nunca muda depois de abrir.
- As fotos vão para o IndexedDB no tamanho original da câmara. Só são comprimidas se o
  técnico abrir o editor de anotações.
- `src/ui/stadiumMap.js` é código morto. Ninguém o importa.
- Há `!important` num bloco no fim de `components.css`, escritos só por causa dos
  `style=""` inline no JS. Podem cair quando o JS for limpo.
- O `PROJECT.md` descreve ficheiros e milestones que não correspondem ao disco.
  Vale a pena reescrevê-lo a partir da realidade.

---

## Uma coisa a não perder

Os números só contam se vierem do medidor. Vários relatos de agentes já foram
verificados e confirmados, mas a regra manteve-se: **correr o ferro e ler o `report.md`**.
Foi assim que se apanhou o bloqueio do seletor de local, que nenhum relatório mencionava.
