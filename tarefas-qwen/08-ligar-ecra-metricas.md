# FICHA 08 — Ligar o ecrã de métricas ao menu

**Tempo:** 15 minutos
**Risco:** Muito baixo
**Ficheiro:** `maintenance_app/src/ui/moreView.js`

## O problema

O ecrã de métricas existe (`src/ui/dashboard.js`, 175 linhas) e a rota também
(`main.js` linha 178, caso `'metrics'`). Mas **nenhum botão da app navega para
lá**. São 175 linhas escritas e testadas que ninguém consegue abrir.

## Alteração

**Procura este texto exato** (está por volta da linha 9, é o primeiro item da
lista `MENU_ITEMS`):

### ANTES
```javascript
const MENU_ITEMS = [
  {
    target: 'reports',
    label: 'Relatórios',
    icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="10.5" y2="15"></line><line x1="12.5" y1="12" x2="15" y2="15"></line><line x1="9" y1="18" x2="15" y2="18"></line>`
  },
```

### DEPOIS
```javascript
const MENU_ITEMS = [
  {
    target: 'reports',
    label: 'Relatórios',
    icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="10.5" y2="15"></line><line x1="12.5" y1="12" x2="15" y2="15"></line><line x1="9" y1="18" x2="15" y2="18"></line>`
  },
  {
    target: 'metrics',
    label: 'Métricas',
    icon: `<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>`
  },
```

## Verificar

```
cd C:\dev\estadio\maintenance_app
npm test
```

Tem de dar `133 passed`.

## Verificação extra (opcional, se souberes arrancar a app)

```
npm run dev
```

Abre `http://localhost:5173`, vai a **Mais** e confirma que aparece a linha
**Métricas** entre "Relatórios" e "Ferramentas e Stock". Toca nela: tem de
abrir um ecrã com números, não um ecrã vazio.

Se abrir vazio ou der erro na consola, escreve
`BLOQUEADO: ecrã de métricas dá erro ao abrir` e desfaz com `git checkout .`.

## Commit

```
git add -A
git commit -m "feat: ligar o ecra de metricas ao menu Mais"
```

## Resposta

```
FICHA: 08
ESTADO: FEITO
TESTES: 133 passed
COMMIT: feat: ligar o ecra de metricas ao menu Mais
```
