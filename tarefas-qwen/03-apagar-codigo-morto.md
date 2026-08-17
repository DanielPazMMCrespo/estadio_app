# FICHA 03 — Apagar código morto

**Tempo:** 20 minutos
**Risco:** Zero (nenhum destes ficheiros é importado por ninguém)
**Ficheiros:** 3 a apagar

## O problema

Três ficheiros que ninguém usa. São ~500 linhas que vão para o pacote final e
confundem quem lê o código. Um deles tem um nome absurdo: nasceu de um comando
mal escrito.

## Antes de apagar — confirmar que ninguém os usa

Corre estes três comandos. **Os três têm de dar resultado vazio** (ou só o
próprio ficheiro):

```
cd C:\dev\estadio\maintenance_app
grep -rn "stadiumMap" src/ index.html
grep -rn "audioService" src/ index.html
```

Se o `grep` do `stadiumMap` mostrar alguma linha **fora** de
`src/ui/stadiumMap.js`, para: escreve `BLOQUEADO: stadiumMap ainda é usado`.

Se o `grep` do `audioService` mostrar alguma linha **fora** de
`src/services/audioService.js`, para: escreve `BLOQUEADO: audioService ainda é usado`.

## Apagar

```
cd C:\dev\estadio\maintenance_app
git rm src/ui/stadiumMap.js
git rm src/services/audioService.js
git rm "card.classList.remove(i.cls))"
```

**Nota sobre o terceiro:** o nome do ficheiro é literalmente
`card.classList.remove(i.cls))` — com parênteses. As aspas no comando são
obrigatórias. Se o `git rm` disser que não existe, corre `ls` na pasta
`maintenance_app` para confirmar o nome exato.

## NÃO apagar

Não apagues `src/ui/dashboard.js`. Parece código morto mas **é usado** —
está importado no `main.js` linha 7. A ficha 08 vai ligá-lo à app.

## Verificar

```
npm test
```

Tem de dar `120 passed`.

## Commit

```
git add -A
git commit -m "chore: apagar codigo morto (stadiumMap, audioService, ficheiro fantasma)"
```

## Resposta

```
FICHA: 03
ESTADO: FEITO
TESTES: 120 passed
COMMIT: chore: apagar codigo morto (stadiumMap, audioService, ficheiro fantasma)
```
