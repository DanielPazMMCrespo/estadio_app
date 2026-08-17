# FICHA 05 — Cabeçalho sem desfoque

**Tempo:** 5 minutos
**Risco:** Zero
**Ficheiro:** `maintenance_app/src/styles/theme.css`

## O problema

O cabeçalho usa `backdrop-filter: blur(12px)`. Essa propriedade força o
telemóvel a repintar o ecrã a cada rolagem. Num Android antigo — que é o
telemóvel provável do técnico — dá arrastos visíveis.

## Alteração 1 de 2 — tirar o desfoque

**Procura este texto exato** (está por volta da linha 329):

### ANTES
```css
.app-header {
  background: var(--color-header-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
```

### DEPOIS
```css
.app-header {
  /* Sem backdrop-filter: o desfoque força uma repintura a cada rolagem e dava
     arrastos visíveis em Android antigo. Cor quase opaca dá o mesmo efeito
     visual sem custo nenhum. */
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-border);
```

## Alteração 2 de 2 — cor mais opaca no tema claro

**Procura este texto exato** (está por volta da linha 129):

### ANTES
```css
  /* Cabeçalho translúcido (o conteúdo passa por baixo ao rolar) */
  --color-header-bg: rgba(255, 255, 255, 0.92);
```

### DEPOIS
```css
  /* Cabeçalho quase opaco: sem desfoque, precisa de mais opacidade para o
     conteúdo que passa por baixo não se ler através dele. */
  --color-header-bg: rgba(255, 255, 255, 0.97);
```

## Alteração 3 de 3 — o mesmo nos dois blocos de tema escuro

O valor `rgba(16, 20, 24, 0.92)` aparece **duas vezes** no ficheiro: uma no
bloco `@media (prefers-color-scheme: dark)` (linha ~222) e outra no bloco
`:root[data-theme="dark"]` (linha ~296). **Troca as duas.**

> **ATENÇÃO — armadilha:** as duas linhas têm **indentação diferente**. A de
> dentro do `@media` tem **4 espaços** à esquerda; a outra tem **2**. Um
> substituir-tudo que inclua a indentação só apanha uma. Trata-as separadamente.

### ANTES (dentro do `@media`, 4 espaços)
```css
    --color-header-bg: rgba(16, 20, 24, 0.92);
```

### DEPOIS
```css
    --color-header-bg: rgba(16, 20, 24, 0.97);
```

### ANTES (no `:root[data-theme="dark"]`, 2 espaços)
```css
  --color-header-bg: rgba(16, 20, 24, 0.92);
```

### DEPOIS
```css
  --color-header-bg: rgba(16, 20, 24, 0.97);
```

Confirma que trocaste as duas:
```
grep -c "rgba(16, 20, 24, 0.97)" src/styles/theme.css
```
Tem de dar `2`.

## Verificar

```
cd C:\dev\estadio\maintenance_app
npm test
```

Tem de dar `133 passed`.

## Commit

```
git add -A
git commit -m "perf: tirar backdrop-filter do cabecalho (arrastos em Android antigo)"
```

## Resposta

```
FICHA: 05
ESTADO: FEITO
TESTES: 133 passed
COMMIT: perf: tirar backdrop-filter do cabecalho (arrastos em Android antigo)
```
