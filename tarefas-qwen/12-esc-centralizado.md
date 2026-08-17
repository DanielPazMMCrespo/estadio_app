# FICHA 12 — Centralizar a função esc()

**Tempo:** 2 horas (três lotes de ~40 min)
**Risco:** Médio — toca em muitos ficheiros
**Ficheiros:** 12 alterados, em 3 lotes

## O problema

A mesma função de escape existe em 16 ficheiros, em três variantes diferentes.
A variante do `history.js` **não escapa a apóstrofe** — risco de injeção em
atributos delimitados por apóstrofe.

## O que já está feito

O utilitário **já existe e já está testado**:

- `maintenance_app/src/utils/html.js` — a função
- `maintenance_app/tests/unit/htmlUtils.test.js` — 7 testes que passam

**Não mexas nestes dois ficheiros.**

## REGRA IMPORTANTE desta ficha

Faz **um lote por sessão** e faz commit no fim de cada lote. **Três commits, não
um.** Se um lote falhar, os anteriores ficam salvos.

---

## O padrão de alteração (igual nos 12 ficheiros)

Para cada ficheiro, fazes sempre duas coisas:

**1. Adicionar o import** logo depois dos outros imports no topo:

```javascript
import { esc } from '../utils/html.js';
```

> Atenção ao caminho: para ficheiros em `src/ui/` é `'../utils/html.js'`.
> Para ficheiros em `src/` (só o `main.js`) é `'./utils/html.js'`.

**2. Apagar o método `esc()` da classe.** É um bloco que se parece com um destes
três (o texto exato muda de ficheiro para ficheiro):

```javascript
  esc(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
```

```javascript
  esc(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
```

```javascript
  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
```

**3. Trocar as chamadas.** Dentro do ficheiro, `this.esc(` passa a ser `esc(`.

No Windows, com PowerShell, para um ficheiro:

```powershell
(Get-Content src/ui/NOME.js -Raw) -replace 'this\.esc\(', 'esc(' | Set-Content src/ui/NOME.js -Encoding utf8
```

> **Faz isto DEPOIS de apagar o método `esc()`**, senão o próprio método fica
> com o nome trocado.

---

## LOTE 1 — os quatro mais simples (~40 min)

Ficheiros (todos em `src/ui/`, todos usam `'../utils/html.js'`):

1. `src/ui/reportsView.js`
2. `src/ui/notesView.js`
3. `src/ui/toolsView.js`
4. `src/ui/equipmentView.js`

Para cada um: adiciona o import, apaga o método `esc()`, troca `this.esc(` por `esc(`.

### Verificar o lote 1

```
cd C:\dev\estadio\maintenance_app
npm test
```

Tem de dar `133 passed`.

Confirma que não sobrou nenhum `this.esc`:
```
grep -n "this.esc" src/ui/reportsView.js src/ui/notesView.js src/ui/toolsView.js src/ui/equipmentView.js
```
Resultado tem de ser vazio.

### Commit do lote 1
```
git add -A
git commit -m "refactor: centralizar esc() nas vistas de relatorios, notas, ferramentas e equipamento"
```

---

## LOTE 2 — os quatro do meio (~40 min)

Ficheiros:

1. `src/ui/history.js` — **este é o que tinha o risco da apóstrofe**
2. `src/ui/reportDetail.js`
3. `src/ui/stadiumNavigator.js`
4. `src/ui/dashboard.js`

Mesmo padrão.

### Verificar o lote 2
```
npm test
```
Tem de dar `133 passed`.

```
grep -n "this.esc" src/ui/history.js src/ui/reportDetail.js src/ui/stadiumNavigator.js src/ui/dashboard.js
```
Resultado vazio.

### Commit do lote 2
```
git add -A
git commit -m "refactor: centralizar esc() no historico, detalhe, navegador e metricas"
```

---

## LOTE 3 — os quatro sensíveis (~40 min)

Ficheiros:

1. `src/ui/homeView.js`
2. `src/ui/quickCapture.js`
3. `src/ui/tasksView.js`
4. `src/ui/locationModal.js`

Mesmo padrão. **Nota:** estes quatro têm testes que os cobrem. Se um teste
falhar, o `git checkout .` desfaz só este lote.

### NÃO incluas nesta ficha

- `src/main.js` — tem 1 176 linhas e vai ser dividido noutra tarefa. Fica para
  depois, para não haver conflito.
- `src/ui/header.js` — tem `escapeHtml()`, não `esc()`. Nome diferente, fica.
- `src/ui/toast.js` — tem `escapeHtml()` interno próprio. Fica.

### Verificar o lote 3
```
npm test
```
Tem de dar `133 passed`.

```
grep -n "this.esc" src/ui/homeView.js src/ui/quickCapture.js src/ui/tasksView.js src/ui/locationModal.js
```
Resultado vazio.

### Commit do lote 3
```
git add -A
git commit -m "refactor: centralizar esc() no ecra Hoje, captura rapida, tarefas e locais"
```

---

## Resposta (uma por lote)

```
FICHA: 12
LOTE: 1
ESTADO: FEITO
TESTES: 133 passed
COMMIT: refactor: centralizar esc() nas vistas de relatorios, notas, ferramentas e equipamento
```
