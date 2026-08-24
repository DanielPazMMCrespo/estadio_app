# Revisão de design — App de Manutenção do Estádio Municipal de Leiria

Data: 2026-08-24 · Estado: passos 1–5 do plano **feitos** (5 commits em `main`).
O design da proposta C (passos 6–8) espera aprovação.

Ficheiros desta revisão:

- [FASE1-MEDICOES.md](FASE1-MEDICOES.md) — as medições, com método.
- [design-2026/propostas/index.html](design-2026/propostas/index.html) — as três
  propostas, lado a lado, em molduras de 393 × 851 px. Abre com duplo clique.

---

## 1. Resumo para quem tem 30 segundos

A discussão não é "quadrados sim ou não". É que **os quadrados estão a ser usados
como menu num ecrã que devia ser painel**.

- O Márcio tem razão no **tamanho**. Quadrados de 152 px acertam-se de luvas.
  Uma linha de lista de 14 px não. Isto não se mexe.
- O Daniel tem razão na **informação**. A home passou a mostrar **zero** dados.
  E os 6 quadrados não abrem uma única porta nova.

Vencedora: **Proposta C — Quadrados vivos**. Mantém a grelha do Márcio e põe os
números dentro dela. 18 pontos de 20 no júri. Menos 4 toques por turno que a
solução de agora.

---

## 2. O problema, em números

Medido no browser, em 393 × 851 px, com **7 avarias abertas (3 críticas, 2 em
curso)** e **4 tarefas para hoje** na base de dados.

| Ecrã Hoje | % do ecrã gasto em botões de navegação | Dados à vista | Ações de 1 toque |
|---|---|---|---|
| **Quadrados (agora)** | **52 %** | **0** | **0** |
| Antes dos quadrados | 18 % | 4 | 2 |

Texto completo que a home mostra hoje:

```
Bom dia! · Estádio Municipal de Leiria
Registar avaria · Foto, voz ou texto
Intervenções · Tarefas · Estádio · Ferramentas · Equipamento · Mais
```

Nenhuma destas palavras é informação. Havia 3 avarias críticas abertas.

### A grelha da home é 100 % redundante

| Quadrado da home | Já se chegava lá por | Toques |
|---|---|---|
| Intervenções | barra inferior | 1 |
| Tarefas | barra inferior | 1 |
| Mais | barra inferior | 1 |
| Estádio | Mais → Estádio | 2 |
| Ferramentas | Mais → Ferramentas | 2 |
| Equipamento | Mais → Equipamento | 2 |

Metade repete a barra de baixo. A outra metade estava a 2 toques. A grelha gasta
metade do primeiro ecrã e não acrescenta um único destino.

---

## 3. As três propostas

### A — Quadrados puros
A ideia do Márcio no seu melhor. A home é uma rampa de lançamento: alvos de
158 px, nada para ler. Tirei os três quadrados que repetiam a barra de baixo e
usei o espaço para aumentar os que ficam.

### B — Lista com dados
A ideia do Daniel. A home é um painel: faixa com 3 números tocáveis, tarefas de
hoje com botão de marcar feita, últimos registos com hora e sala. Sem grelha.

### C — Quadrados vivos *(híbrido)*
A grelha fica, com o tamanho dela, mas **cada quadrado diz o seu número**. Acima
da grelha entra uma linha só: a coisa mais urgente agora, com o botão de fechar
ao lado. Um quadrado vermelho vê-se de longe — não é preciso ler para saber que
há problema.

### Medições das três (mesmos dados, mesma moldura)

| | Agora | A | B | **C** |
|---|---|---|---|---|
| % navegação no 1.º ecrã | 52 % | 47 % | 10 % | **17 %** |
| Factos à vista sem scroll | 0 | 0 | 8 | **5** |
| Ações de 1 toque | 0 | 0 | 3 | **1** |
| Ecrãs de scroll | 1,08 | 1,00 | 1,21 | **1,00** |
| Alvo mais pequeno | 124 px | 158 px | 48 px | **48 px** (grelha 126 px) |

### Contagem de toques nas 8 tarefas mais frequentes

| # | Tarefa | Agora | A | B | **C** |
|---|---|---|---|---|---|
| T1 | Registar avaria (texto) | 2 | 2 | 2 | **2** |
| T2 | Registar avaria numa sala | 4 | 4 | 5 | **4** |
| T3 | Saber quantas críticas há | 2 + contar | 2 + contar | 0 | **0** |
| T4 | Marcar tarefa de hoje feita | 2 | 2 | 1 | **1** |
| T5 | Ver as tarefas de hoje | 1 | 1 | 0 | **0** |
| T6 | Ver o que registei hoje | 1 | 1 | 0 | **1** |
| T7 | Ver avarias abertas de uma sala | 3 | 3 | 4 | **3** |
| T8 | Abrir Ferramentas e Stock | 1 | 1 | 2 | **1** |
| | **Total** | **16** | **16** | **14** | **12** |

---

## 4. O júri

Quatro lentes, nota de 1 a 5 por proposta.

### Juiz 1 — Toques e velocidade

| | Nota | Porquê |
|---|---|---|
| A | 3 | 16 toques. Alvos enormes encurtam o tempo de apontar, mas o caminho é longo. |
| B | 4 | 14 toques. Alvos menores obrigam a apontar com mais cuidado. |
| **C** | **5** | **12 toques, com alvos grandes. Ganha nas duas metades.** |

### Juiz 2 — Uso no terreno (luvas, sol, ruído, uma mão)

| | Nota | Porquê |
|---|---|---|
| **A** | **5** | **158 px. Zero leitura. É o melhor possível para uma mão de luva.** |
| B | 3 | Linhas de 66 px, muito texto ao sol, e 1,21 ecrãs de scroll com uma mão. |
| C | 4 | Grelha de 126 px mantém-se. Há números para ler, mas o quadrado vermelho lê-se sem palavras. |

### Juiz 3 — Densidade de informação

| | Nota | Porquê |
|---|---|---|
| A | 1 | Zero factos. Com 3 críticas abertas, o ecrã cala-se. |
| **B** | **5** | **8 factos e 3 ações sem tocar em nada.** |
| C | 4 | 5 factos. Diz os totais, mas não diz os nomes das outras tarefas. |

### Juiz 4 — Elegância e coerência com o `theme.css`

| | Nota | Porquê |
|---|---|---|
| A | 4 | Muito calmo e regular. Mas um ecrã inteiro de botões iguais é monótono. |
| B | 3 | Faixa + dois tipos de cartão + hero = quatro linguagens no mesmo ecrã. |
| **C** | **5** | **Uma linguagem só, com um acento vermelho. Reaproveita as classes `.ht-*` que já existem.** |

### Soma

| Proposta | J1 | J2 | J3 | J4 | **Total** |
|---|---|---|---|---|---|
| A — Quadrados puros | 3 | 5 | 1 | 4 | **13** |
| B — Lista com dados | 4 | 3 | 5 | 3 | **15** |
| **C — Quadrados vivos** | **5** | **4** | **4** | **5** | **18** |

**Vence a C.** O que se enxerta das outras duas:

- **de A**: tirar os três quadrados que repetem a barra de baixo, e juntá-los num
  quadrado deitado "Mais" — é o que a C já faz.
- **de B**: o botão de marcar feita com 48 px, aplicado à linha "A seguir".
- **de B**: cada número é um atalho para a lista **já filtrada**. Tocar no 7 de
  Avarias abre a lista de abertas, não a lista toda.

---

## 5. Como fica a C, em concreto

Ecrã Hoje, de cima para baixo:

1. **Botão verde "Registar avaria"** — largura toda, 62 px. Inalterado.
2. **Linha "A seguir"** — a tarefa crítica de hoje ou, se não houver, a avaria
   crítica mais antiga. Um botão redondo de 48 px à esquerda fecha-a no lugar.
   Se não houver nada urgente, a linha desaparece; não fica um vazio.
3. **Quatro quadrados vivos**, 2 × 2:
   - **Avarias** — total aberto em número grande; subtítulo `N críticas`.
     Fundo vermelho se houver críticas. Abre a lista filtrada por abertas.
   - **Tarefas** — total de hoje; subtítulo `hoje · N crítica(s)`.
   - **Estádio** — quantos setores têm avaria aberta. Abre a grelha de setores.
   - **Ferramentas** — quantas estão abaixo do stock mínimo. Âmbar se > 0.
4. **Quadrado deitado "Mais"** — Equipamento · Métricas · Notas · Definições.

Regras de cor (sem inventar tokens novos):

| Estado | Fundo | Número |
|---|---|---|
| há críticas | `--tint-red` | `--color-danger-text` |
| há avisos (stock baixo, em curso) | `--tint-amber` | `--color-warning-text` |
| tudo em ordem | `--color-card` | `--color-success-text` |

O quadrado só grita quando há razão. Num dia calmo o ecrã fica branco e sereno.

---

## 6. Melhorias de código (independentes do design)

| # | Problema | Onde | Gravidade |
|---|---|---|---|
| C1 | Fuga de ouvintes: 2 ouvintes `online`/`offline` por visita à home, nunca removidos. Medido: 10 em 5 visitas. | [homeView.js:131](maintenance_app/src/ui/homeView.js:131) | **alta** |
| C6 | `aggregateIssues` compara nomes com `String.includes`; se falhar, atira a avaria para o **primeiro setor**. Número errado no quadrado errado. | [stadiumNavigator.js:246](maintenance_app/src/ui/stadiumNavigator.js:246) | **alta** |
| C2 | `stadiumMap.js`, 321 linhas, nenhum ecrã importa — **mas `tests/unit/field_tools.test.js` importa**. Apagar obriga a mexer nos testes, o que a regra 3 proíbe. Fica, com esta nota. | [stadiumMap.js](maintenance_app/src/ui/stadiumMap.js) | aberto |
| C3 | CSS órfão do acordeão que já não existe: `.sector-card*`, `.sectors-accordion-list`, `.sec-status-badge`, `.room-row`. | [components.css:130](maintenance_app/src/styles/components.css:130) | média |
| C4 | Pesquisa de salas sem *debounce*: cada letra redesenha 33 salas e religa todos os ouvintes. | [stadiumNavigator.js:305](maintenance_app/src/ui/stadiumNavigator.js:305) | média |
| C11 | `.ht-tile` herda `font-size: 13.3px`. Texto novo dentro de um quadrado nasce ilegível. | [quadrados.css:52](maintenance_app/src/styles/quadrados.css:52) | média |
| C5 | Três cabeçalhos iguais com nomes diferentes: `.ht-header` / `.ev-header` / `.mv-header`. | 3 ficheiros CSS | baixa |
| C9 | `main.js` tem 53 `style="` e 24 `font-size` inline — o pior ficheiro do projeto. | [main.js](maintenance_app/src/main.js) | baixa |
| C7 | 503 do `/api/health` a cada 30 s enchem a consola em desenvolvimento. | [syncEngine.js](maintenance_app/src/services/syncEngine.js) | baixa |
| C8 | `CLAUDE.md` desatualizado: diz `133 passed` (real: **175**) e `--color-brand-primary: #0F6E5C` (real: **#557D14**). | [CLAUDE.md](CLAUDE.md) | baixa |
| C10 | Ficheiros-lixo na raiz e em `maintenance_app/`: `0)`, `HTTP`, `{`. | raiz | baixa |

---

## 7. Plano de execução — um commit por passo

Só arranca depois de aprovação. Cada passo acaba com `npm test` a dar
**175 passed** e `npm run verificar:estilos` a dizer `OK`.

| Passo | Commit | Estado |
|---|---|---|
| 1 | `fix: home deixa de acumular ouvintes de rede` (`f0b55e6`) | **feito.** Medido: 10 adicionados, 10 removidos, saldo 0. |
| 2 | `fix: avaria sem sala conhecida deixa de contar no primeiro setor` (`d4304fe`) | **feito.** 8 abertas, uma com local inexistente → 7 nos setores certos + 1 em `unmatched`. |
| 3 | `chore: apaga o css do acordeao de setores que ja nao existe` (`1d80871`) | **feito** para o CSS: 41 regras órfãs, `components.css` 3135 → 2877 linhas. `stadiumMap.js` **não** foi apagado (ver C2). |
| 4 | `fix: pesquisa de salas com debounce de 200ms` (`afe8d53`) | **feito.** A escrever "caldeira": 8 redesenhos → 1. |
| 5 | `style: font-size minimo no proprio .ht-tile` (`b730e82`) | **feito.** 13,3px → 18px, layout intacto. |
| 6 | `feat: quadrados vivos no ecra Hoje` | O centro da proposta C: números dentro dos 4 quadrados + quadrado "Mais" deitado. |
| 7 | `feat: linha "A seguir" com marcar-feita de um toque` | A linha urgente no topo do ecrã Hoje. |
| 8 | `feat: cada numero abre a lista ja filtrada` | Tocar em Avarias → lista de abertas; em Tarefas → hoje. |
| 9 | `refactor: um so cabecalho de vista (.v-header)` (`cb9a97b`) | **feito.** Três blocos iguais → um. Margem 16px nos três ecrãs. |
| 10 | `docs: CLAUDE.md a par do codigo real` (`785964c`) | **feito.** Testes, verde da marca, contagens de linhas, ordem dos CSS, pendentes. |
| 11 | `chore: apaga 19 ficheiros-lixo de 0 bytes` (`0838c7a`) | **feito.** Todos com 0 bytes; ícones a sério intactos. |

Passos 1 a 5 **estão feitos** (5 commits em `main`). Depois de cada um:
`npm test` → `175 passed`, `npm run verificar:estilos` → `OK: nada piorou`.

Os passos 6 a 8 são a proposta C e esperam aprovação. Todos os outros estão
feitos.

Além do plano, o commit `4acedb2` fechou o trabalho de desenho que estava por
commitar no diretório (ecrã Estádio em quadrados, sétimo quadrado do Mais
deitado). Nota honesta: os commits `d4304fe` e `b730e82` levaram atrás partes
desse trabalho, porque os ficheiros estavam alterados no diretório quando as
correções entraram — as mensagens desses dois commits descrevem só a correção.

---

## 8. Para mostrar ao Márcio

A grelha dele foi uma boa decisão e fica. Muda-se uma coisa só: em vez de o
quadrado dizer "Avarias", passa a dizer "**7** Avarias · 3 críticas" — e fica
vermelho quando há críticas.

Custa zero toques a mais. Poupa 4 por turno. E o técnico sabe o estado do estádio
no segundo em que desbloqueia o telemóvel.
