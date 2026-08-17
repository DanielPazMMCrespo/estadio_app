import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
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
let totalEstilos = 0, totalFontSize = 0;
const porFicheiro = [];
for (const caminho of ficheiros) {
  const texto = readFileSync(caminho, 'utf8');
  const estilos = contar(texto, /style="/g);
  const fontes = contar(texto, /font-size\s*:/g);
  totalEstilos += estilos; totalFontSize += fontes;
  if (estilos > 0 || fontes > 0) porFicheiro.push({ caminho: caminho.replace(RAIZ, 'src'), estilos, fontes });
}
porFicheiro.sort((a, b) => b.estilos - a.estilos);
console.log('\nEstilos inline por ficheiro:\n');
for (const f of porFicheiro) console.log(`  ${String(f.estilos).padStart(4)} style="   ${String(f.fontes).padStart(3)} font-size   ${f.caminho}`);
console.log(`\n  TOTAL: ${totalEstilos} style="  (limite ${LIMITE_ESTILOS})`);
console.log(`  TOTAL: ${totalFontSize} font-size  (limite ${LIMITE_FONTSIZE})\n`);
let falhou = false;
if (totalEstilos > LIMITE_ESTILOS) { console.error(`FALHOU: subiu para ${totalEstilos}.`); falhou = true; }
if (totalFontSize > LIMITE_FONTSIZE) { console.error(`FALHOU: font-size subiu para ${totalFontSize}.`); falhou = true; }
if (falhou) process.exit(1);
console.log('OK: nada piorou.\n');
