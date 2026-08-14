import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Core Shell & Manifest Asset Verification', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const publicSwPath = path.join(rootDir, 'public/sw.js');
  const publicManifestPath = path.join(rootDir, 'public/manifest.webmanifest');
  const rootSwPath = path.join(rootDir, 'sw.js');
  const rootManifestPath = path.join(rootDir, 'manifest.webmanifest');

  it('verifies public/sw.js and public/manifest.webmanifest exist while root files are removed', () => {
    expect(fs.existsSync(publicSwPath)).toBe(true);
    expect(fs.existsSync(publicManifestPath)).toBe(true);
    expect(fs.existsSync(rootSwPath)).toBe(false);
    expect(fs.existsSync(rootManifestPath)).toBe(false);
  });

  it('validates public/manifest.webmanifest content and structure', () => {
    const rawContent = fs.readFileSync(publicManifestPath, 'utf8');
    const manifest = JSON.parse(rawContent);

    expect(manifest.name).toBe('Manutenção Estádio Leiria');
    expect(manifest.short_name).toBe('Estádio');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color.toUpperCase()).toBe('#0B132B');
    expect(manifest.background_color.toUpperCase()).toBe('#0B132B');

    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const iconSrcs = manifest.icons.map(icon => icon.src);
    expect(iconSrcs).toContain('/icons/icon-192.png');
    expect(iconSrcs).toContain('/icons/icon-512.png');
  });

  it('verifies public/sw.js precache STATIC_ASSETS contains no unbundled /src/ paths', () => {
    const swContent = fs.readFileSync(publicSwPath, 'utf8');

    // Extract STATIC_ASSETS array definition
    const match = swContent.match(/STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/);
    expect(match).not.toBeNull();

    const assetsBlock = match[1];
    expect(assetsBlock).not.toContain('/src/');

    expect(assetsBlock).toContain("'/index.html'");
    expect(assetsBlock).toContain("'/manifest.webmanifest'");
    expect(assetsBlock).toContain("'/favicon.ico'");
    expect(assetsBlock).toContain("'/icons/icon-192.png'");
    expect(assetsBlock).toContain("'/icons/icon-512.png'");
  });

  it('verifies index.html links to /manifest.webmanifest', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    expect(htmlContent).toMatch(/<link\s+rel=["']manifest["']\s+href=["']\/manifest\.webmanifest["']\s*\/>/);
  });

  it('verifies src/main.js registers Service Worker at /sw.js', () => {
    const mainJsPath = path.join(rootDir, 'src/main.js');
    const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

    expect(mainJsContent).toContain("navigator.serviceWorker.register('/sw.js')");
  });
});
