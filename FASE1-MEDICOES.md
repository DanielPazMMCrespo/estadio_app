# Fase 1 — Números medidos (não são opiniões)

Medido em `393×851` (Pixel 5), com a base de dados carregada de propósito com
**8 intervenções, 7 abertas (3 críticas, 2 em curso)** e **4 tarefas pendentes para hoje**.

Ferramenta: medição em DOM no browser (`getBoundingClientRect`), não estimativa.

---

## 1. Ponto de partida dos testes

| | Valor |
|---|---|
| `npm test` | **175 passed** (17 ficheiros), 12,9 s |
| `npm run verificar:estilos` | OK — 162 `style="` (limite 271), 49 `font-size` (limite 110) |

> **Corrigir o `CLAUDE.md`**: diz `133 passed`. O número real é `175`.

---

## 2. Densidade de cada ecrã

`% navegação` = percentagem do primeiro ecrã ocupada por botões que só servem
para ir a outro sítio. `Factos` = elementos com dados reais da base de dados
visíveis sem fazer scroll.

| Vista | % navegação | Factos visíveis | Ecrãs de scroll |
|---|---|---|---|
| **home (quadrados)** | **52 %** | **0** | 1,08 |
| **more (quadrados)** | **51 %** | **0** | 1,07 |
| **sectors (quadrados)** | **64 %** | 11 | 1,14 |
| tasks | 7 % | 17 | 1,69 |
| history | 7 % | 8 | 3,00 |
| tools | 7 % | 8 | 8,98 |
| equipment | 7 % | 0 | 13,27 |
| notes | 7 % | 0 | 1,18 |
| metrics | 7 % | 0 | 1,72 |
| reports | 7 % | 0 | 2,48 |

**home vs. home antigo** (mesmo dispositivo, mesmos dados):

| | Quadrados (agora) | Antigo (`16c6205`) |
|---|---|---|
| % navegação no 1.º ecrã | **52 %** | **18 %** |
| Factos visíveis sem scroll | **0** | 4 |
| Tarefas de hoje à vista | 0 | 2 (de 4) |
| Registos de hoje à vista | 0 | 3 |
| Ações de 1 toque | 0 | 2 (marcar tarefa feita) |

Texto que a home mostra hoje, por inteiro:

```
Bom dia!
Estádio Municipal de Leiria
Registar avaria / Foto, voz ou texto
Intervenções · Tarefas · Estádio · Ferramentas · Equipamento · Mais
```

Nada disto é informação. Com 7 avarias abertas e 3 críticas na base de dados, a
home não diz uma palavra sobre elas.

---

## 3. Contagem de toques (8 tarefas mais frequentes)

| # | Tarefa | Quadrados | Antigo | Quem ganha |
|---|---|---|---|---|
| T1 | Registar avaria (texto) | 2 | 2 | empate |
| T2 | Registar avaria numa sala | **4** | 5 | **quadrados** |
| T3 | Saber quantas críticas estão abertas | 2 + contar à mão | **2, número já escrito** | antigo |
| T4 | Marcar tarefa de hoje como feita | 2 | **1** | antigo |
| T5 | Ver as tarefas de hoje | 1 | **0** | antigo |
| T6 | Ver o que registei hoje | 1 | **0** | antigo |
| T7 | Ver avarias abertas de uma sala | **3** | 4 | **quadrados** |
| T8 | Abrir Ferramentas e Stock | **1** | 2 | **quadrados** |
| | **Total** | **16** | **16** | empate |

Leitura: o total é igual, mas está trocado de sítio.

- Os quadrados **encurtam o caminho para páginas secundárias** (T2, T7, T8).
  O menu "Mais" era um beco de dois toques. Isso ficou resolvido.
- Os quadrados **alongam o caminho para o trabalho de hoje** (T3–T6), que é o
  que o técnico faz dezenas de vezes por dia.

---

## 4. Redundância da grelha da home

Barra inferior: **Hoje · Intervenções · Tarefas · Mais**.
Quadrados da home: Intervenções · Tarefas · Estádio · Ferramentas · Equipamento · Mais.
Menu "Mais": Relatórios · Métricas · Ferramentas · Equipamento · Estádio · Notas · Definições.

| Quadrado da home | Já se chega lá por | Toques sem o quadrado |
|---|---|---|
| Intervenções | barra inferior | 1 |
| Tarefas | barra inferior | 1 |
| Mais | barra inferior | 1 |
| Estádio | Mais → Estádio | 2 |
| Ferramentas | Mais → Ferramentas | 2 |
| Equipamento | Mais → Equipamento | 2 |

**Nenhum dos 6 quadrados da home é um destino novo.** Metade repete a barra
inferior. A grelha gasta 52 % do primeiro ecrã e não abre uma única porta que
não estivesse já aberta.

---

## 5. Acessibilidade da grelha nova — está boa

| Elemento | Tamanho | Texto | Regra |
|---|---|---|---|
| Quadrado da home | 159 × 124 px | 21 px | ✅ ≥48 px, ≥18 px |
| Quadrado de setor | 175 × 152 px | 19 px | ✅ |
| Quadrado do "Mais" | 159 × 124 px | 21 px | ✅ |
| Botão verde "Registar" | 329 × 99 px | 21 px | ✅ |
| Aba da barra inferior | 74 × 62 px | 18 px | ✅ |
| Número no canto (`.ht-flag`) | 31 × 28 px | 18 px | ✅ |

Isto é um ganho real dos quadrados: alvos de 124–152 px acertam-se de luvas.
Uma linha de lista de 14 px não.

**Uma armadilha**: `.ht-tile` herda `font-size: 13.3px`. Qualquer texto novo
posto dentro de um quadrado sem classe própria nasce ilegível. Precisa de
`font-size` mínimo no próprio `.ht-tile`.

---

## 6. Problemas de código encontrados

| # | Problema | Onde | Gravidade |
|---|---|---|---|
| C1 | Fuga de ouvintes: 2 ouvintes `online`/`offline` por cada visita à home, nunca removidos. Medido: **10 ouvintes em 5 visitas**. | `src/ui/homeView.js:131` | alta |
| C2 | Componente órfão: 321 linhas nunca importadas por ninguém | `src/ui/stadiumMap.js` | média |
| C3 | CSS órfão: `.sector-card*`, `.sectors-accordion-list`, `.sec-status-badge`, `.room-row` — o acordeão de setores já não existe | `src/styles/components.css:130-300, 1248, 1596` | média |
| C4 | Pesquisa de salas sem *debounce*: cada letra volta a desenhar 33 salas e a religar todos os ouvintes | `src/ui/stadiumNavigator.js:305` | média |
| C5 | Três cabeçalhos iguais com nomes diferentes: `.ht-header`/`.ev-header`/`.mv-header` | `quadrados.css`, `views-estadio.css`, `views-more.css` | baixa |
| C6 | `aggregateIssues` compara nomes de locais com `String.includes` e, se falhar, atira a avaria para o **primeiro setor**. Um número errado no quadrado errado. | `src/ui/stadiumNavigator.js:246` | alta |
| C7 | 503 do `/api/health` a cada 30 s enchem a consola em desenvolvimento | `syncEngine.js` | baixa |
| C8 | `CLAUDE.md` diz `133 passed`; o real é `175 passed` | `CLAUDE.md` §3, §10, §11 | baixa |
| C9 | `main.js` tem 53 `style="` e 24 `font-size` inline — o pior ficheiro do projeto | `src/main.js` | baixa |
| C10 | Ficheiros-lixo continuam na raiz e em `maintenance_app/` (`0)`, `HTTP`, `{`) | raiz | baixa |

---

## 7. Conclusão da Fase 1

Os dois lados têm razão em metades diferentes:

- **Márcio tem razão** no alvo de toque e no caminho para as páginas
  secundárias. 152 px de luvas contra 14 px de lista não é discussão.
- **Daniel tem razão** na informação. A home passou de 4 factos e 2 ações de um
  toque para **zero**. E os 6 quadrados não abrem nenhuma porta nova.

O problema não é "quadrados sim ou não". É que os quadrados estão a ser usados
como **menu** num ecrã que devia ser **painel**.

Caminho que os números apontam: manter a grelha grande e tocável, mas pôr dados
vivos dentro dela, e devolver o bloco "Hoje" acima da grelha. É a proposta C.
