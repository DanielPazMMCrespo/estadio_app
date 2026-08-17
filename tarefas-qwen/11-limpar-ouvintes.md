# FICHA 11 — Limpar ouvintes de cliques acumulados

**Tempo:** 1 hora
**Risco:** Baixo
**Ficheiros:** 2

## O problema

Três sítios adicionam `document.addEventListener('click', …)` e **nunca o
removem**. O ecrã Hoje redesenha a cada gravação. Depois de 30 gravações num
turno, há 30 ouvintes de cliques acumulados na página. A app fica
progressivamente mais lenta — e um técnico não fecha a app.

## Alteração 1 — homeView.js

**Ficheiro:** `maintenance_app/src/ui/homeView.js`

**Alteração 1a — guardar a referência** (está por volta da linha 15):

### ANTES
```javascript
    this.dictationCleanup = null;
  }
```

### DEPOIS
```javascript
    this.dictationCleanup = null;
    // Referência ao ouvinte de cliques na página, para o poder remover.
    // Sem isto, cada redesenho do ecrã deixava um ouvinte para trás.
    this.outsideClickHandler = null;
  }
```

**Alteração 1b — remover o antigo antes de pôr o novo** (está por volta da linha 320):

### ANTES
```javascript
          // Close on outside click
          document.addEventListener('click', (e) => {
            if (!locInput.contains(e.target) && !locDropdown.contains(e.target)) {
              locDropdown.style.display = 'none';
            }
          });
```

### DEPOIS
```javascript
          // Fechar ao tocar fora. O ouvinte anterior é removido primeiro:
          // este ecrã redesenha a cada gravação e os ouvintes acumulavam-se.
          if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
          }
          this.outsideClickHandler = (e) => {
            if (!locInput.contains(e.target) && !locDropdown.contains(e.target)) {
              locDropdown.style.display = 'none';
            }
          };
          document.addEventListener('click', this.outsideClickHandler);
```

## Alteração 2 — quickCapture.js

**Ficheiro:** `maintenance_app/src/ui/quickCapture.js`

**Alteração 2a — guardar a referência** (está por volta da linha 14):

### ANTES
```javascript
    this.dictationCleanup = null;
  }
```

### DEPOIS
```javascript
    this.dictationCleanup = null;
    // Referência ao ouvinte de cliques na página, removido no close().
    this.outsideClickHandler = null;
  }
```

**Alteração 2b — guardar em vez de anónimo** (está por volta da linha 190):

### ANTES
```javascript
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!locInput.contains(e.target) && !locDropdown.contains(e.target)) {
          locDropdown.style.display = 'none';
        }
      });
```

### DEPOIS
```javascript
      // Fechar ao tocar fora. Guardado numa referência para o close() o poder
      // remover — esta folha abre e fecha muitas vezes por turno.
      this.outsideClickHandler = (e) => {
        if (!locInput.contains(e.target) && !locDropdown.contains(e.target)) {
          locDropdown.style.display = 'none';
        }
      };
      document.addEventListener('click', this.outsideClickHandler);
```

**Alteração 2c — remover ao fechar** (está no fim do ficheiro, por volta da linha 261):

### ANTES
```javascript
  close() {
    speechService.stopListening();
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
```

### DEPOIS
```javascript
  close() {
    speechService.stopListening();
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
```

## Verificar

```
cd C:\dev\estadio\maintenance_app
npm test
```

Tem de dar `133 passed`.

## Verificação extra (opcional)

Confirma que não sobrou nenhum ouvinte anónimo nestes dois ficheiros:

```
grep -n "document.addEventListener('click', (e)" src/ui/homeView.js src/ui/quickCapture.js
```

Tem de dar **resultado vazio**. Se mostrar alguma linha, ficou um por corrigir.

## Nota sobre o locationModal.js

O `src/ui/locationModal.js` linha 129 tem o mesmo problema, mas esse ficheiro
tem uma estrutura diferente. **Não o toques nesta ficha** — fica para depois.

## Commit

```
git add -A
git commit -m "fix: remover ouvintes de cliques acumulados a cada redesenho"
```

## Resposta

```
FICHA: 11
ESTADO: FEITO
TESTES: 133 passed
COMMIT: fix: remover ouvintes de cliques acumulados a cada redesenho
```
