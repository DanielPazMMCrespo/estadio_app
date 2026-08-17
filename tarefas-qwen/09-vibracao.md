# FICHA 09 — Vibração nas ações importantes

**Tempo:** 30 minutos
**Risco:** Muito baixo
**Ficheiros:** 1 novo + 2 alterados

## O problema

Ao lado de um gerador a trabalhar, o técnico não ouve o aviso e, com o ecrã ao
sol, não lê a mensagem. Mas sente a vibração no bolso.

## Passo 1 — criar o ficheiro novo

**Cria o ficheiro:** `maintenance_app/src/services/haptics.js`

Com este conteúdo exato:

```javascript
/**
 * Vibração curta como confirmação física.
 *
 * Porque existe: o técnico trabalha ao lado de máquinas (não ouve o aviso) e
 * ao sol (não lê a mensagem no ecrã). A vibração é o único canal que sobra.
 *
 * Nunca lança: em iOS o navigator.vibrate não existe e isso é normal, não é erro.
 */

function buzz(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* Sem vibração disponível — segue sem ruído na consola. */
  }
}

export const haptics = {
  /** Gravou, marcou como feito, sincronizou. Um toque seco. */
  success() { buzz(40); },

  /** Apagou algo, ou uma ação falhou. Dois toques — dá para distinguir sem olhar. */
  warning() { buzz([60, 50, 60]); },

  /** Toque leve em botões de escolha (prioridade, dia). */
  tap() { buzz(15); }
};
```

## Passo 2 — vibrar ao gravar uma intervenção

**Ficheiro:** `maintenance_app/src/ui/quickCapture.js`

**Alteração 2a — importar** (linha 4, no topo):

### ANTES
```javascript
import { toast } from './toast.js';
```

### DEPOIS
```javascript
import { toast } from './toast.js';
import { haptics } from '../services/haptics.js';
```

**Alteração 2b — usar** (está por volta da linha 234):

### ANTES
```javascript
        try {
          await reportsRepo.create(newReport);
          this.close();
          toast.success('Intervenção registada no telemóvel');
```

### DEPOIS
```javascript
        try {
          await reportsRepo.create(newReport);
          haptics.success();
          this.close();
          toast.success('Intervenção registada no telemóvel');
```

## Passo 3 — vibrar ao marcar uma tarefa como feita

**Ficheiro:** `maintenance_app/src/ui/tasksView.js`

**Alteração 3a — importar** (linha 3, no topo):

### ANTES
```javascript
import { toast } from './toast.js';
```

### DEPOIS
```javascript
import { toast } from './toast.js';
import { haptics } from '../services/haptics.js';
```

**Alteração 3b — usar** (está por volta da linha 268):

### ANTES
```javascript
    try {
      const { nextTask } = await tasksRepo.toggleDone(id);
      if (nextTask) {
```

### DEPOIS
```javascript
    try {
      const { nextTask } = await tasksRepo.toggleDone(id);
      haptics.success();
      if (nextTask) {
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
git commit -m "feat: vibracao ao gravar intervencao e ao marcar tarefa feita"
```

## Resposta

```
FICHA: 09
ESTADO: FEITO
TESTES: 120 passed
COMMIT: feat: vibracao ao gravar intervencao e ao marcar tarefa feita
```
