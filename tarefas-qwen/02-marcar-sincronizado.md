# FICHA 02 — Marcar registos como sincronizados

**Tempo:** 1 hora
**Risco:** Baixo
**Ficheiro:** `maintenance_app/src/services/syncEngine.js`

## O problema

O motor de sincronização apaga os itens da fila depois de o servidor confirmar,
mas nunca marca os registos como sincronizados. O campo `synced` fica sempre a 0.
Resultado: todos os cartões dizem "Local" para sempre, mesmo depois de subirem.
O indicador mente ao técnico.

## Alteração 1 de 2 — importar os repositórios

**Procura este texto exato** (linhas 1 e 2, no topo do ficheiro):

### ANTES
```javascript
import { db } from '../db/db.js';
import { toast } from '../ui/toast.js';
```

### DEPOIS
```javascript
import { db } from '../db/db.js';
import { toast } from '../ui/toast.js';

/**
 * As tabelas que guardam um campo `synced`. Depois de o servidor confirmar
 * uma mutação, o registo correspondente é marcado como sincronizado — sem
 * isto, o indicador do cartão dizia "Local" para sempre.
 */
const SYNCED_TABLES = {
  report: 'reports',
  reports: 'reports',
  task: 'tasks',
  tasks: 'tasks',
  note: 'notes',
  notes: 'notes',
  tool: 'tools',
  tools: 'tools',
  equipment: 'equipment',
  location: 'locations',
  locations: 'locations'
};
```

## Alteração 2 de 2 — marcar depois da confirmação

**Procura este texto exato** (está por volta da linha 233):

### ANTES
```javascript
        if (toDelete.length > 0) {
          await db.sync_queue.bulkDelete(toDelete);
          pushedCount = toDelete.length;
        }
```

### DEPOIS
```javascript
        if (toDelete.length > 0) {
          // Marcar como sincronizado ANTES de apagar da fila: se algo falhar
          // pelo caminho, é melhor um registo marcado a mais do que uma
          // mutação perdida.
          const confirmedItems = queueItems.filter(q => confirmedSet.has(String(q.id)));
          for (const item of confirmedItems) {
            const tableName = SYNCED_TABLES[item.entityType];
            if (!tableName || !db[tableName] || !item.entityId) continue;
            try {
              await db[tableName].update(item.entityId, { synced: 1 });
            } catch (err) {
              // Um registo já apagado localmente não é um erro: segue.
              console.info('[SyncEngine] Não foi possível marcar como sincronizado:', item.entityId);
            }
          }

          await db.sync_queue.bulkDelete(toDelete);
          pushedCount = toDelete.length;
        }
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
git commit -m "fix: marcar registos como sincronizados depois do servidor confirmar"
```

## Resposta

```
FICHA: 02
ESTADO: FEITO
TESTES: 120 passed
COMMIT: fix: marcar registos como sincronizados depois do servidor confirmar
```
