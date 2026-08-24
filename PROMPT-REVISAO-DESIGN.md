# Prompt para o Claude Code — Revisão total da app do Estádio

Cola tudo o que está abaixo da linha numa sessão nova do Claude Code, em `C:\dev\estadio`.

---

Lê primeiro o `CLAUDE.md` deste repositório. Ele descreve a app real, as regras
de trabalho e o design system. Não confies no `PROJECT.md` (está desatualizado).

## Contexto

Esta é uma PWA offline-first para técnicos de manutenção do Estádio Municipal de
Leiria. O técnico usa luvas, está ao sol, e ao lado de máquinas com ruído. A rede
falha muitas vezes.

Existe um desacordo de design entre duas pessoas:

- **Márcio (chefe)**: quer o design em "quadrados" (grelha de mosaicos) para a
  página principal, para o menu "Mais" e para as áreas do estádio. Já foi
  aplicado. Ver os commits `e622b73`, `51a1f29` e as alterações não commitadas em
  `maintenance_app/src/styles/quadrados.css`,
  `maintenance_app/src/ui/stadiumNavigator.js`,
  `maintenance_app/src/ui/moreView.js`,
  `maintenance_app/src/styles/views-more.css`,
  `maintenance_app/src/styles/views-estadio.css`.
- **Daniel (autor do código)**: acha que os quadrados tiram praticidade. Os
  mosaicos são só botões de navegação: não mostram informação. Isso obriga a mais
  toques e esconde o que é importante.

Não escolhas um lado por simpatia. Decide com base em provas.

## Objetivos da app (por ordem de prioridade)

1. **Menos toques** para as tarefas mais frequentes (registar uma avaria, ver o
   que está pendente, fechar uma tarefa).
2. **Informação importante visível logo** ao abrir cada página. Um ecrã que só
   tem botões é um ecrã desperdiçado.
3. **Completo**: nada do que existe hoje pode desaparecer.
4. **Elegante e calmo**, sem ruído visual.
5. **Acessível com luvas e ao sol**: toques ≥48px, texto ≥18px, contraste alto.

## O que tens de fazer

### Fase 1 — Ler e medir (não mudes código ainda)

- Lê `maintenance_app/src/main.js`, todos os ficheiros de `src/ui/` e de
  `src/styles/`, e o `design-2026/` (6 mockups `.dc.html`).
- Corre `npm test` em `maintenance_app` e confirma que dá `133 passed`. Este é o
  ponto de partida.
- Abre a app com as ferramentas de Browser, config `estadio-dev`, em ecrã de
  telemóvel (393×851). Tira fotos de cada vista.
- Faz uma **contagem de toques**: para cada uma das 8 tarefas mais frequentes,
  conta os toques desde abrir a app até acabar. Faz a contagem duas vezes: com o
  design de quadrados de agora, e com o design anterior (`git stash` ou
  `git show 44c98a2`). Põe os números numa tabela.
- Faz uma **contagem de densidade**: em cada vista, quantos píxeis mostram
  informação e quantos mostram só botões de navegação.

### Fase 2 — Três propostas independentes

Escreve **três** propostas de design completas e diferentes entre si:

- **A — Quadrados puros**: a visão do Márcio, levada ao melhor que consegue ser.
- **B — Lista com dados**: a visão do Daniel, cartões com informação real e
  contadores.
- **C — Híbrido**: quadrados que mostram números e estado dentro do próprio
  mosaico ("mosaicos vivos"), ou outra ideia melhor que descubras.

Cada proposta precisa de: um esboço em HTML/CSS que se veja no browser, a
contagem de toques prevista, e o que perde e o que ganha.

### Fase 3 — Júri

Avalia as três propostas com **quatro juízes independentes**, cada um com uma
lente diferente:

1. **Toques e velocidade** — quantos toques, quanto tempo até à informação.
2. **Uso no terreno** — luvas, sol, ruído, uma mão só, ecrã sujo.
3. **Densidade de informação** — o que se vê sem tocar em nada.
4. **Elegância e coerência** — respeito pelo design system do `theme.css`.

Cada juiz dá nota de 1 a 5 por proposta, com justificação curta. Depois faz a
soma e escolhe uma vencedora. Podes enxertar as melhores ideias das outras duas.

### Fase 4 — Relatório

Produz um ficheiro `REVISAO-DESIGN-2026.md` na raiz, com:

- A tabela de toques (antes vs. depois vs. proposta vencedora).
- As notas dos quatro juízes.
- A recomendação final, em português simples, pronta a mostrar ao Márcio.
- Uma lista de melhorias de código encontradas pelo caminho (código repetido,
  CSS morto, estilos inline, fugas de ouvintes de eventos, ficheiros-lixo).
- Um plano de execução por passos, cada passo com um commit próprio.

### Fase 5 — Implementar (só depois de eu aprovar)

Para depois de eu ler o relatório. **Não implementes nada na Fase 5 sem eu dizer.**

## Regras que não podes quebrar

- `npm test` tem de dar sempre `133 passed`. Se der menos, `git checkout .` e
  reporta o bloqueio.
- Não instales pacotes. Não mexas no `package.json`.
- Não mexas em `tests/`.
- Não apagues comentários em português.
- Não metas `style="…"` novo no JavaScript. Corre `npm run verificar:estilos`.
- Não mudes de branch nem faças `push`.
- Zoom do utilizador fica ligado. Nada de `maximum-scale=1`.
- Texto de leitura nunca abaixo de 18px.
- Um assunto por commit, mensagem em português minúscula com prefixo
  `feat:` / `fix:` / `refactor:` / `style:` / `docs:`.
- Não uses servidores pelo Bash. Usa as ferramentas de Browser com
  `{name: "estadio-dev"}`.

Começa pela Fase 1 e mostra-me os números antes de avançares.
