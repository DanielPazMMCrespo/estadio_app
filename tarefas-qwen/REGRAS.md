# REGRAS — Lê isto antes de qualquer tarefa

Tu és um executor. Não és um arquiteto. As decisões já estão todas tomadas.

## As 8 regras

1. **Faz UMA ficha por sessão.** Nunca duas. Acaba, testa, faz commit, para.
2. **Não decidas nada.** Se a ficha não diz, não inventes — escreve `BLOQUEADO` e para.
3. **Não mexas em ficheiros que a ficha não nomeia.** Nem para "melhorar".
4. **Copia o `DEPOIS` exatamente.** Não reformates, não renomeies, não traduzas comentários.
5. **Corre sempre `npm test` no fim.** Tem de dar `133 passed`. Se der menos, desfaz tudo com `git checkout .` e escreve `BLOQUEADO`.
6. **Não crias ficheiros novos** a não ser que a ficha diga o caminho exato.
7. **Não instalas pacotes.** Nenhum. A app não tem dependências novas.
8. **Se o `ANTES` não existir no ficheiro**, para. Não procures parecido. Escreve `BLOQUEADO`.

## Como executar uma ficha

```
cd C:\dev\estadio\maintenance_app
```

1. Abre a ficha (ex: `tarefas-qwen/01-locationid-nulo.md`)
2. Abre o ficheiro que ela indica
3. Procura o bloco `ANTES` — texto exato
4. Substitui pelo bloco `DEPOIS` — texto exato
5. Corre `npm test`
6. Se der `133 passed` → `git add -A && git commit -m "<a mensagem que está na ficha>"`
7. Se der menos → `git checkout .` e escreve `BLOQUEADO: <o que aconteceu>`

## Formato da resposta

No fim de cada ficha, responde só isto:

```
FICHA: 01
ESTADO: FEITO
TESTES: 133 passed
COMMIT: fix: <mensagem>
```

Ou:

```
FICHA: 01
ESTADO: BLOQUEADO
MOTIVO: <uma frase>
```

Nada mais. Sem explicações, sem resumos, sem sugestões.

## O que NUNCA fazer

- Não corras `npm install`, `npm update`, `npm audit fix`
- Não mexas no `package.json`
- Não mexas em `tests/`
- Não apagues comentários em português — são decisões documentadas
- Não mudes `git` de branch nem faças `push`
- Não uses `git commit --amend`
- Não juntes duas fichas num commit

## Ordem das fichas

Faz por esta ordem. Não saltes.

```
01-locationid-nulo.md          30 min   CRÍTICO — perde trabalho
02-marcar-sincronizado.md      1 h      CRÍTICO — indicador mente
03-apagar-codigo-morto.md      20 min   limpeza, risco zero
04-reativar-zoom.md            5 min    acessibilidade
05-header-sem-blur.md          5 min    performance
06-debounce-pesquisa.md        15 min   performance
07-splash-mais-rapido.md       10 min   performance
08-ligar-ecra-metricas.md      15 min   ecrã inalcançável
09-vibracao.md                 30 min   feedback tátil
10-comprimir-fotos.md          3 h      CRÍTICO — 8 MB por foto
11-limpar-ouvintes.md          1 h      fugas de memória
12-esc-centralizado.md         2 h      16 cópias → 1
13-eslint-anti-inline.md       1 h      impede recaída
```

## Se algo correr mal

Desfazer a ficha atual:
```
git checkout .
```

Desfazer o último commit (mantendo o código):
```
git reset --soft HEAD~1
```

Voltar ao estado inicial de todo o plano:
```
git reset --hard b4d6e1f
```
