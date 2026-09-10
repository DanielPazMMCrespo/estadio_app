/**
 * Rede de segurança do ecrã de arranque: tira o splash mesmo que o módulo
 * principal falhe. Ficheiro separado (não inline) para a Content-Security-Policy
 * poder proibir scripts em linha. 1,5s é folga — a animação normal sai aos 900ms.
 */
(function () {
  setTimeout(function () {
    try {
      var s = document.getElementById('splash-screen');
      if (s && s.parentNode) s.parentNode.removeChild(s);
    } catch (e) { /* o splash fica; a app continua por baixo */ }
  }, 1500);
})();
