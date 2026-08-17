# FICHA 01 — Corrigir local nulo que perde o registo

**Tempo:** 30 minutos
**Risco:** Muito baixo
**Ficheiro:** `maintenance_app/src/ui/quickCapture.js`

## O problema

Quando o técnico escreve o nome do local com o teclado em vez de o escolher da
lista, o código põe `selectedLocId` a `null`. O repositório rejeita isso e lança
um erro. O técnico vê "Erro ao guardar" e perde o que escreveu.

## Alteração 1 de 2

**Procura este texto exato** (está por volta da linha 209):

### ANTES
```javascript
        // Se digitou algo no input mas não escolheu da lista, usamos o texto
        if (locInput && locInput.value !== this.selectedLocName) {
           this.selectedLocName = locInput.value.trim() || 'Estádio — local não indicado';
           this.selectedLocId = null;
        }
```

### DEPOIS
```javascript
        // Se digitou algo no input mas não escolheu da lista, usamos o texto.
        // O id fica LOC_UNKNOWN e nunca null: o reportsRepo.create() exige um id
        // e, com null, o registo era rejeitado e o técnico perdia o que escreveu.
        if (locInput && locInput.value !== this.selectedLocName) {
           this.selectedLocName = locInput.value.trim() || 'Estádio — local não indicado';
           this.selectedLocId = 'LOC_UNKNOWN';
        }
```

## Alteração 2 de 2

**Procura este texto exato** (está por volta da linha 219):

### ANTES
```javascript
        const newReport = {
          locationId: this.selectedLocId,
          locationName: this.selectedLocName,
```

### DEPOIS
```javascript
        const newReport = {
          locationId: this.selectedLocId || 'LOC_UNKNOWN',
          locationName: this.selectedLocName,
```

## Verificar

```
cd C:\dev\estadio\maintenance_app
npm test
```

Tem de dar `120 passed`.

## Commit

```
git add -A
git commit -m "fix: gravar intervencao com local escrito a mao deixa de falhar"
```

## Resposta

```
FICHA: 01
ESTADO: FEITO
TESTES: 120 passed
COMMIT: fix: gravar intervencao com local escrito a mao deixa de falhar
```
