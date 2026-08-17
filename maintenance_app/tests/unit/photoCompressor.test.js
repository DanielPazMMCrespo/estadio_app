import { describe, it, expect } from 'vitest';
import { fitWithin, compressPhoto } from '../../src/services/photoCompressor.js';

describe('photoCompressor', () => {
  it('nao amplia fotos pequenas', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('reduz mantendo proporcao', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });
  it('trata retrato', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it('aguenta valores invalidos', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(undefined, undefined)).toEqual({ width: 0, height: 0 });
  });
  it('devolve o original quando a imagem nao descodifica', async () => {
    const blob = new Blob([new Uint8Array([255,216,255])], { type: 'image/jpeg' });
    const r = await compressPhoto(blob);
    expect(r.blob).toBeTruthy();
    expect(r.mimeType).toBe('image/jpeg');
  }, 15000);
  it('nunca lanca com entrada nula', async () => {
    const r = await compressPhoto(null);
    expect(r.compressed).toBe(false);
  });
});
