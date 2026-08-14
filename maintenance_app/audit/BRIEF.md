# Contrato de design — app de manutenção do Estádio Municipal de Leiria

Todos os agentes (construtores e críticos) leem este ficheiro antes de mexer em nada.
Decisões já tomadas pelo cliente. Não são para rediscutir.

---

## 1. Quem usa isto

Um técnico de manutenção de **60 anos**. De **luvas**. Com **uma mão** livre.
Ao lado de **máquinas a fazer barulho**. Muitas vezes **ao sol**, no relvado ou no exterior.
Quer **registar tudo sem ter de pensar**.

Consequências que não se negociam:
- Nada de campos obrigatórios que ele não saiba responder no momento.
- Nada que precise de duas mãos, de precisão de dedo, ou de ler letra pequena.
- Se falhar a ligação, grava sempre. E diz-lho de forma honesta.
- Português de Portugal em tudo o que ele vê.

## 2. A barra (medida, não opinada)

| Critério | Alvo |
|---|---|
| Alvo de toque visível | **≥ 48 × 48 px CSS** |
| Texto de corpo | **≥ 18 px CSS** |
| Do ecrã bloqueado até a avaria gravada | **≤ 3 toques** |
| Erros de consola | **0** |
| Scroll horizontal | **nenhum** |

Ferro: `node audit/measure.mjs --label <nome>` a partir de `maintenance_app/`.
Escreve `audit/<nome>/report.md` e `audit/<nome>/shots/*.png`.
**Correr o ferro e ler o report.md não é opcional.** Números reportados sem o ferro não contam.

## 3. Tema — DECIDIDO: claro por defeito

O tema preto com texto cinzento foi rejeitado. Ao sol não se lê.

```
Fundo            #FFFFFF
Fundo alternado  #F4F6F8   (o cinzento por trás dos cartões)
Cartão           #FFFFFF   com borda subtil e sombra suave
Texto            #14181E
Texto secundário #4A5560   (nunca mais claro do que isto para texto de leitura)
Borda            #D8DEE4
Azul MMCrespo    #0284c7   (ação primária, ligações)
Verde MMCrespo   #059669   (concluído, ok)
Âmbar            #B45309   (atenção, pendente, offline)
Vermelho         #C81E1E   (crítico, avariado, apagar)
```

- Corpo **18px**. Títulos de cartão **22px**. Números grandes de contador **32px+**.
- Peso faz a hierarquia, não o tamanho: negrito para o título, regular para o resto.
- O escuro fica como **opção** nas definições, não por defeito.
- Nada de tipos de letra da internet. Pilha do sistema. A app é **offline total**.

## 4. Navegação — DECIDIDO: 4 abas + Mais

```
Barra inferior:  [ Hoje ]  [ Avarias ]  [ Tarefas ]  [ Mais ]
```

- Cada aba com **≥ 48px** de altura e rótulo a **≥ 18px**.
- **Mais** abre uma lista de linhas grandes: Ferramentas, Equipamento, Setores, Notas, Definições.
- A ação primária de registar avaria fica **em cima**, como no Limble novo, e também
  disponível dentro de cada sala e de cada equipamento.

## 5. A app contra a qual somos julgados

`maintenance_app/.limble-ref/` — 39 imagens reais. Ler `.limble-ref/MANIFEST.md` primeiro.

**Existem duas apps Limble diferentes. Julgamos contra a NOVA.**

- **Nova** (março 2026) — ficheiros `new-*`, `new-tablet-*`, `real-*`, `web-01`.
  Navy + verde lima na marca, mas o interior é **claro**: cartões brancos sobre cinzento claro.
  4 abas em baixo (Home / Tasks / Assets / More). Fila de pastilhas verdes de ação **no topo**,
  sem botão flutuante. Prioridade e estado são **texto colorido**, não etiquetas cheias.
  Linhas de lista em cartão, 4 linhas por cartão, ~4 cartões por ecrã, folga generosa.
  Ícones de traço fino. Um ativo é sempre um **cubo de arame**, nunca uma foto.
- **Legada** — ficheiros `legacy-*`. Verde floresta, linhas apertadas, gaveta de hambúrguer.
  Serve só como contexto. **Não é o alvo.**
- `real-01` a `real-06`, `qr-01`, `qr-02`, `legacy-17`, `legacy-18` são **pixels reais do produto**,
  sem moldura de marketing. São os ficheiros de confiança para julgar espaçamento e tamanho.

### Onde o Limble é fraco e nós temos de ganhar

Medido nas imagens reais dele:
- Os metadados dele estão a ~13–14px. O nosso corpo está a 18px. **Ganhamos em legibilidade.**
- Os rótulos das abas dele são pequenos. Os nossos são 18px.
- Ele pede título, prioridade, tipo de tarefa, data de fim e data de início para criar uma ordem.
  Nós gravamos com **a descrição e mais nada**.
- Ele assume ligação. Nós somos **offline total** e dizemos-lho.

### Onde o Limble ganha hoje

- Hierarquia de local sempre visível (migalhas: sítio → edifício → equipamento → filho).
- Trabalho identificado sempre por **tipo + #número**.
- Instruções como **lista de passos numerados** com temporizador e barra de percentagem.
- Ler QR/código de barras como porta de entrada de primeiro nível.
- Cartões com muito ar. Nada apertado.

## 6. Como o crítico julga

1. Abre o **output real** num viewport de telemóvel (390×844). Não julga código nem descrições.
2. Põe o nosso screenshot ao lado do ecrã equivalente do Limble, **sem etiquetas**, sem saber qual é qual.
3. Responde a uma pergunta: **qual destes dois é melhor para o homem de 60 anos, de luvas, com uma mão,
   ao lado de uma máquina a fazer barulho?**
4. Nomeia **o maior buraco que falta**. Um só, o maior.
5. Elogios não contam para nada. Se o nosso não ganhar, a peça volta ao construtor.

## 7. O que já está errado no código (medido, não suposto)

- `#location-dropdown` nunca é preenchido por código nenhum → **é impossível registar uma avaria
  pelo botão +**. O guardar recusa por falta de local.
- Não existe motor de sincronização. `syncEngine.js`, `syncQueue.js`, `connectivity.js` não estão
  no disco, apesar de o `PROJECT.md` os listar. A `sync_queue` só cresce.
- `main.js` chama `header.setOnlineState()`. O componente só tem `updateStatus()`.
  O estado online/offline nunca muda depois de abrir.
- O CSS das classes `.toast*` nunca foi escrito. As confirmações aparecem como texto solto.
- `main.css` importa a Inter do Google Fonts. Quebra o offline.
- `--color-navy` é usado e nunca foi definido.
- As fotos vão para o IndexedDB no tamanho original da câmara. Só são comprimidas se o técnico
  abrir o editor de anotações.
- `src/ui/stadiumMap.js` é código morto. Ninguém o importa.
- Data/hora e tempo gasto são obrigatórios para registar uma avaria.

## 8. Coisas que faltam por completo

- Tarefas para **hoje** e **amanhã**.
- **Notas soltas**.
- **Stock de ferramentas** com quantidades, tirar e repor.
- **Equipamento instalado** no estádio, ligado a localização, com histórico.

## 9. Regras de engenharia

- Vanilla JS, ES modules, sem frameworks, sem TypeScript. Vite. Dexie.
- Mantém os nomes de classe CSS existentes. Outro código depende deles.
- Estilos inline em `style=""` dentro do JS são dívida. Quem tocar no JS tira-os para o CSS.
- Toda a mutação escreve na `sync_queue` na **mesma transação** Dexie.
- `synced` e `deleted` são números `0|1` (são indexáveis), nunca booleanos.
- Datas em ISO 8601. Dias de calendário no fuso **local**, nunca UTC.
- Antes de dizer que acabaste: corre `npx vitest run` e `node audit/measure.mjs`. Números reais ou nada.
