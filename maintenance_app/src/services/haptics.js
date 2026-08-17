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
