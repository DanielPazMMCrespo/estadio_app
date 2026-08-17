import { describe, it, expect } from 'vitest';
import { esc, attr } from '../../src/utils/html.js';

describe('utils/html esc()', () => {
  it('escapa os cinco caracteres perigosos', () => {
    expect(esc(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
  it('escapa a apostrofe (a variante antiga do history.js nao escapava)', () => {
    expect(esc("O'Brien")).toBe('O&#39;Brien');
  });
  it('neutraliza uma tentativa de injecao', () => {
    expect(esc('<script>alert(1)</script>')).not.toContain('<script>');
  });
  it('devolve string vazia para nulo e undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
  it('aceita numeros e zero', () => {
    expect(esc(0)).toBe('0');
    expect(esc(42)).toBe('42');
  });
  it('nao altera texto normal em portugues', () => {
    expect(esc('Relvado Principal — Piso 0')).toBe('Relvado Principal — Piso 0');
  });
  it('attr() faz o mesmo que esc()', () => {
    expect(attr(`a"b'c`)).toBe(esc(`a"b'c`));
  });
});
