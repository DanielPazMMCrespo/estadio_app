# FICHA 13 — Guarda contra estilos inline

**Tempo:** 1 hora
**Risco:** Zero (só adiciona um comando de verificação)
**Ficheiro:** 1 novo + `package.json`

## O problema

A app tem 220 estilos escritos à mão dentro do JavaScript. Sem uma guarda, depois
de os limpar voltam todos em seis meses e a revisão tem de ser feita outra vez.

## Porque não é ESLint

O ESLint precisaria de instalar pacotes novos, e a regra do plano é: **zero
dependências novas**. Um script de 40 linhas em Node faz o mesmo trabalho sem
instalar nada.

## Passo 1 — criar o ficheiro

**Cria o ficheiro:** `maintenance_app/scripts/verificar-estilos.mjs`

Com este conteúdo exato:

```javascript
/**
 * Guarda contra estilos inline no JavaScript.
 *
 * Porque existe: a app tinha 220 estilos escritos à mão dentro do JS. Isso
 * contorna os tokens do theme.css, obriga a !important no CSS e quebra o tema
 * escuro. Sem esta guarda, voltam todos em seis meses.
 *
 * Correr:  node scripts/verificar-estilos.mjs
 * Devolve 1 se o número subir acima do limite registado abaixo.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/**
 * Limite atual, medido em 17/08/2026. Nunca subir este número — só descer.
 * Cada vez que uma tarefa limpar estilos, baixa-se este valor para o novo total.
 */
const LIMITE_ESTILOS = 271;
const LIMITE_FONTSIZE = 110;

function listarFicheirosJs(dir) {
  const encontrados = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarFicheirosJs(caminho));
    } else if (nome.endsWith('.js')) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

function contar(texto, padrao) {
  const achados = texto.match(padrao);
  return achados ? achados.length : 0;
}

const ficheiros = listarFicheirosJs(RAIZ);
let totalEstilos = 0;
let totalFontSize = 0;
const porFicheiro = [];

for (const caminho of ficheiros) {
  const texto = readFileSync(caminho, 'utf8');
  const estilos = contar(texto, /style="/g);
  const fontes = contar(texto, /font-size\s*:/g);
  totalEstilos += estilos;
  totalFontSize += fontes;
  if (estilos > 0 || fontes > 0) {
    porFicheiro.push({ caminho: caminho.replace(RAIZ, 'src'), estilos, fontes });
  }
}

porFicheiro.sort((a, b) => b.estilos - a.estilos);

console.log('\nEstilos inline por ficheiro:\n');
for (const f of porFicheiro) {
  console.log(`  ${String(f.estilos).padStart(4)} style="   ${String(f.fontes).padStart(3)} font-size   ${f.caminho}`);
}

console.log(`\n  TOTAL: ${totalEstilos} style="  (limite ${LIMITE_ESTILOS})`);
console.log(`  TOTAL: ${totalFontSize} font-size  (limite ${LIMITE_FONTSIZE})\n`);

let falhou = false;
if (totalEstilos > LIMITE_ESTILOS) {
  console.error(`FALHOU: os estilos inline subiram de ${LIMITE_ESTILOS} para ${totalEstilos}.`);
  console.error('Usa uma classe CSS. As cores e tamanhos vivem em src/styles/, não no JS.\n');
  falhou = true;
}
if (totalFontSize > LIMITE_FONTSIZE) {
  console.error(`FALHOU: os font-size no JS subiram de ${LIMITE_FONTSIZE} para ${totalFontSize}.`);
  console.error('Usa as variáveis --fs-* do theme.css.\n');
  falhou = true;
}

if (falhou) process.exit(1);

console.log('OK: nada piorou.\n');
```

## Passo 2 — juntar ao package.json

**Ficheiro:** `maintenance_app/package.json`

**Procura este texto exato:**

### ANTES
```json
    "test": "vitest run",
```

### DEPOIS
```json
    "test": "vitest run",
    "verificar:estilos": "node scripts/verificar-estilos.mjs",
```

## Verificar

```
cd C:\dev\estadio\maintenance_app
npm run verificar:estilos
```

Tem de terminar com `OK: nada piorou.` e mostrar uma tabela por ficheiro.

Se disser `FALHOU`, o limite no script está mais baixo que a realidade — sobe o
`LIMITE_ESTILOS` para o número que ele mostra em `TOTAL` e volta a correr.

E depois:
```
npm test
```
Tem de dar `133 passed`.

## Como usar daqui para a frente

Cada vez que uma tarefa futura limpar estilos inline de um ficheiro, corre-se
`npm run verificar:estilos`, vê-se o novo total, e **baixa-se** o
`LIMITE_ESTILOS` para esse número. O limite só desce. Assim nunca há recaída.

## Commit

```
git add -A
git commit -m "chore: guarda contra estilos inline no JavaScript"
```

## Resposta

```
FICHA: 13
ESTADO: FEITO
TESTES: 133 passed
VERIFICACAO: OK: nada piorou
COMMIT: chore: guarda contra estilos inline no JavaScript
```
