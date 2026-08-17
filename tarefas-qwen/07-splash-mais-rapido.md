# FICHA 07 — Ecrã de arranque mais rápido

**Tempo:** 10 minutos
**Risco:** Zero
**Ficheiros:** 2

## O problema

O ecrã de arranque fica 1,6 segundos antes de começar a desaparecer, e há uma
rede de segurança a 3 segundos. Para uma app que se abre 30 vezes por dia, é
quase um minuto perdido por dia.

## Alteração 1 de 2

**Ficheiro:** `maintenance_app/src/styles/main.css`

**Procura este texto exato** (está por volta da linha 82):

### ANTES
```css
  animation: splashFadeOut 400ms ease-out 1.6s forwards;
```

### DEPOIS
```css
  /* 600ms em vez de 1,6s: a app abre 30 vezes por dia e o logótipo já foi
     visto. O tempo é do trabalho, não da marca. */
  animation: splashFadeOut 300ms ease-out 600ms forwards;
```

## Alteração 2 de 2

**Ficheiro:** `maintenance_app/index.html`

**Procura este texto exato** (está por volta da linha 44):

### ANTES
```html
  <!-- Failsafe: remove splash even if module fails -->
  <script>setTimeout(function(){var s=document.getElementById('splash-screen');if(s)s.remove();},3000);</script>
```

### DEPOIS
```html
  <!-- Rede de segurança: tira o ecrã de arranque mesmo que o módulo falhe.
       1,5s é folga suficiente — a animação normal já saiu aos 900ms. -->
  <script>setTimeout(function(){var s=document.getElementById('splash-screen');if(s)s.remove();},1500);</script>
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
git commit -m "perf: ecra de arranque de 3s para 900ms"
```

## Resposta

```
FICHA: 07
ESTADO: FEITO
TESTES: 133 passed
COMMIT: perf: ecra de arranque de 3s para 900ms
```
