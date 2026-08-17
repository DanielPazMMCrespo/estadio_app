# FICHA 04 — Reativar o zoom do utilizador

**Tempo:** 5 minutos
**Risco:** Zero
**Ficheiro:** `maintenance_app/index.html`

## O problema

A app bloqueia o zoom. Um técnico não consegue ampliar para ler uma etiqueta
numa foto ou um número de série pequeno. Isto falha a norma de acessibilidade
WCAG 1.4.4.

## Alteração

**Procura este texto exato** (linha 5):

### ANTES
```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

### DEPOIS
```html
  <!-- O zoom fica LIGADO de propósito: o técnico precisa de ampliar para ler
       etiquetas e números de série nas fotos. Bloquear o zoom falha a WCAG 1.4.4. -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
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
git commit -m "fix: reativar o zoom do utilizador (WCAG 1.4.4)"
```

## Resposta

```
FICHA: 04
ESTADO: FEITO
TESTES: 133 passed
COMMIT: fix: reativar o zoom do utilizador (WCAG 1.4.4)
```
