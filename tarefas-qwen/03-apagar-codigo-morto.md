# FICHA 03 — Apagar o ficheiro fantasma

**Tempo:** 5 minutos
**Risco:** Zero
**Ficheiros:** 1 a apagar

## Correção desta ficha (17/08/2026)

A versão anterior desta ficha mandava apagar **três** ficheiros. Estava errada.

Ao executar, descobriu-se que `src/ui/stadiumMap.js` e
`src/services/audioService.js` **são importados por
`tests/unit/field_tools.test.js`** (linhas 5 e 6). A verificação original só
tinha olhado para `src/` e para o `index.html` — nunca para `tests/`.

Apagá-los rebenta 4 testes. E apagar os testes também está proibido pela regra 7.

**Portanto: ficam.** São código que a app não usa mas que está sob teste — isso
é uma decisão a tomar com o dono do projeto, não uma limpeza mecânica.

## O problema que sobra

Um ficheiro com nome de linha de código, criado por acidente por um comando mal
escapado. Está vazio (0 bytes) e não é importado por ninguém.

## Apagar

```
cd C:\dev\estadio\maintenance_app
git rm "card.classList.remove(i.cls))"
```

**Nota:** o nome do ficheiro é literalmente `card.classList.remove(i.cls))` —
com parênteses. As aspas no comando são obrigatórias. Se o `git rm` disser que
não existe, corre `ls` na pasta `maintenance_app` para confirmar o nome exato.

## NÃO apagar

- `src/ui/stadiumMap.js` — testado pelo `field_tools.test.js`
- `src/services/audioService.js` — testado pelo `field_tools.test.js`
- `src/ui/dashboard.js` — é usado, importado no `main.js` linha 7. A ficha 08
  vai ligá-lo à app.

## Verificar

```
npm test
```

Tem de dar `133 passed`.

## Commit

```
git add -A
git commit -m "chore: apagar ficheiro fantasma criado por comando mal escapado"
```

## Resposta

```
FICHA: 03
ESTADO: FEITO
TESTES: 133 passed
COMMIT: chore: apagar ficheiro fantasma criado por comando mal escapado
```
