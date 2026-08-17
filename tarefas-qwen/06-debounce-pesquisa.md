# FICHA 06 — Travar a pesquisa 250 ms

**Tempo:** 15 minutos
**Risco:** Baixo
**Ficheiro:** `maintenance_app/src/ui/history.js`

## O problema

A pesquisa redesenha a lista inteira a cada tecla. Escrever "relvado" com 2 000
avarias na base de dados são 7 redesenhos completos. A app trava a escrever.

## Alteração 1 de 2 — guardar o temporizador

**Procura este texto exato** (está por volta da linha 18):

### ANTES
```javascript
    this.activeFilter = options.initialFilter || 'all'; // 'all' | 'critical' | 'pending' | 'in_progress' | 'resolved'
    this.sectorFilter = options.initialSector || null;
  }
```

### DEPOIS
```javascript
    this.activeFilter = options.initialFilter || 'all'; // 'all' | 'critical' | 'pending' | 'in_progress' | 'resolved'
    this.sectorFilter = options.initialSector || null;
    // Temporizador da pesquisa: sem isto, cada tecla redesenhava a lista toda.
    this.searchTimer = null;
  }
```

## Alteração 2 de 2 — esperar antes de redesenhar

**Procura este texto exato** (está por volta da linha 211):

### ANTES
```javascript
    const searchInput = this.container.querySelector('#input-search-reports');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.refreshFeed();
      });
    }
```

### DEPOIS
```javascript
    const searchInput = this.container.querySelector('#input-search-reports');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        // Espera 250 ms sem escrever antes de redesenhar. Escrever "relvado"
        // passa de 7 redesenhos completos da lista para 1.
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.searchTimer = null;
          this.refreshFeed();
        }, 250);
      });
    }
```

## Verificar

```
cd C:\dev\estadio\maintenance_app
npm test
```

Tem de dar `133 passed`.

## Commit

```
git add -A
git commit -m "perf: travar a pesquisa 250ms antes de redesenhar a lista"
```

## Resposta

```
FICHA: 06
ESTADO: FEITO
TESTES: 133 passed
COMMIT: perf: travar a pesquisa 250ms antes de redesenhar a lista
```
