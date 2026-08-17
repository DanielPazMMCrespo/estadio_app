# Começar aqui

## O que é isto

13 fichas de trabalho para um modelo executor (Qwen ou outro).
Cada ficha tem o código exato **antes** e **depois**. Não há decisões para tomar.

## Como usar

Abre o Qwen na pasta `C:\dev\estadio` e cola **exatamente** este texto, mudando
só o número da ficha:

```
Lê C:\dev\estadio\tarefas-qwen\REGRAS.md e segue-o à letra.

Depois executa APENAS a ficha C:\dev\estadio\tarefas-qwen\01-locationid-nulo.md

Não faças mais nenhuma ficha. Não mexas em ficheiros que a ficha não nomeia.
No fim responde só com o bloco de 4 linhas que a ficha pede.
```

Quando ele responder `ESTADO: FEITO`, abres uma **conversa nova** e repetes com a
ficha seguinte. Uma ficha por conversa — contexto limpo, menos erros.

## Porque uma ficha por conversa

Um modelo fraco com muito contexto começa a misturar tarefas e a "melhorar"
coisas que ninguém pediu. Contexto curto e uma tarefa só é o que o mantém dentro
dos carris.

## Ordem

| Ficha | O quê | Tempo | Testes esperados no fim |
|---|---|---|---|
| 01 | Local nulo que perde o registo | 30 min | 133 passed |
| 02 | Marcar como sincronizado | 1 h | 133 passed |
| 03 | Apagar código morto | 20 min | 133 passed |
| 04 | Reativar o zoom | 5 min | 133 passed |
| 05 | Cabeçalho sem desfoque | 5 min | 133 passed |
| 06 | Travar a pesquisa 250 ms | 15 min | 133 passed |
| 07 | Arranque mais rápido | 10 min | 133 passed |
| 08 | Ligar o ecrã de métricas | 15 min | 133 passed |
| 09 | Vibração | 30 min | 133 passed |
| 10 | Ligar a compressão de fotos | 1 h | 133 passed |
| 11 | Limpar ouvintes acumulados | 1 h | 133 passed |
| 12 | Centralizar `esc()` — 3 lotes | 2 h | 133 passed |
| 13 | Guarda contra estilos inline | 1 h | 133 passed |

**Total: cerca de 9 horas de trabalho do executor.**

> Nota sobre os números: as fichas 01 a 09 dizem `120 passed` ou `126 passed` no
> texto porque foram escritas antes de as peças novas entrarem. **O número certo
> hoje é 133.** Se o Qwen disser 133, está correto.

## O que já está feito e testado

Estas três peças já existem no repositório, já foram testadas, e as fichas só as
ligam ao resto. **O executor não as deve alterar:**

- `maintenance_app/src/services/photoCompressor.js` — compressão de fotos
- `maintenance_app/src/utils/html.js` — a função `esc()` única
- `maintenance_app/scripts/verificar-estilos.mjs` — guarda contra recaída

## Se o Qwen ficar bloqueado

Ele deve responder `ESTADO: BLOQUEADO` com um motivo numa frase. Quando isso
acontecer:

1. Confirma que o código está limpo: `git status --short`
2. Se houver alterações a meio, desfaz: `cd maintenance_app && git checkout .`
3. Passa essa ficha à frente e faz a seguinte
4. Guarda o motivo — as fichas bloqueadas vêm para mim depois

## Rede de segurança

Cada ficha faz o seu próprio commit. Se algo correr mal:

```
cd C:\dev\estadio
git log --oneline -10          # ver o que foi feito
git reset --hard 17ff57c       # voltar ao ponto de partida deste plano
```

O commit `17ff57c` é o estado antes de qualquer ficha ser executada.

## Depois das 13 fichas

O que sobra do plano de consenso são os itens que **precisam de decisões de
arquitetura** e não se devem dar a um modelo executor:

- Dividir o `main.js` em três ficheiros (item 17 do plano)
- Fotos em tabela separada (item 25)
- Etiquetas QR nos equipamentos (item 31)
- Modo turno (item 35)

Esses voltam para uma sessão comigo, ou fazem-se com fichas novas escritas da
mesma forma.
