import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { APP_APK_URL, generateQrSvg } from '../../src/config.ts';

describe('DescargaApp component and configuration', () => {
  it('exposes exactly the official GitHub Releases APK download URL', () => {
    expect(APP_APK_URL).toBe(
      'https://github.com/AbrahamEsquivel/LostNet/releases/latest/download/app-debug.apk'
    );
  });

  it('generates a valid SVG QR code for APP_APK_URL without runtime errors', async () => {
    const svg = await generateQrSvg(APP_APK_URL);
    expect(typeof svg).toBe('string');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="180"');
    expect(svg).toContain('height="180"');
    expect(svg).toContain('viewBox=');
  });

  it('DescargaApp.astro template uses APP_APK_URL and satisfies all required props', () => {
    const componentSource = readFileSync(
      resolve(process.cwd(), 'src/components/DescargaApp.astro'),
      'utf8'
    );

    // Imports config constant
    expect(componentSource).toMatch(/import\s*\{[^}]*APP_APK_URL[^}]*\}\s*from\s*['"]\.\.\/config['"]/);

    // Heading and subtitle
    expect(componentSource).toContain('Descarga LostNet para Android');
    expect(componentSource).toContain('Recibe alertas de objetos perdidos cerca de ti.');

    // Button uses APP_APK_URL, download attribute, rel="noopener" and clear text
    expect(componentSource).toContain('href={APP_APK_URL}');
    expect(componentSource).toMatch(/download(\s|>|=)/);
    expect(componentSource).toContain('rel="noopener"');
    expect(componentSource).toContain('Descargar APK');

    // QR accessibility and text
    expect(componentSource).toContain('aria-label="Código QR para descargar la app Android de LostNet"');
    expect(componentSource).toContain('title="Código QR de descarga"');
    expect(componentSource).toContain('Escanéalo con tu celular');

    // QR hidden on mobile, visible on desktop
    expect(componentSource).toContain('hidden md:flex');

    // Installation steps details
    expect(componentSource).toContain('<details');
    expect(componentSource).toContain('¿Cómo instalarla?');
    expect(componentSource).toContain('Descarga el APK');
    expect(componentSource).toContain('Instalar apps desconocidas');
    expect(componentSource).toContain('Abre el archivo e instala');
  });

  it('landing page (index.astro) integrates the section and navigation links', () => {
    const indexSource = readFileSync(
      resolve(process.cwd(), 'src/pages/index.astro'),
      'utf8'
    );

    // Component imported and placed in a section with id="descarga-app"
    expect(indexSource).toMatch(/import\s+DescargaApp\s+from\s+['"]\.\.\/components\/DescargaApp\.astro['"]/);
    expect(indexSource).toContain('id="descarga-app"');
    expect(indexSource).toContain('<DescargaApp');

    // Navigation and footer links that scroll to #descarga-app
    expect(indexSource).toMatch(/href="#descarga-app"[^>]*>[\s\S]*?App Android/);
  });

  it('verifies static build dist/index.html includes the download button with exact APK link and QR svg', () => {
    const distPath = resolve(process.cwd(), 'dist/index.html');
    if (!existsSync(distPath)) return; // Only checks when dist exists

    const html = readFileSync(distPath, 'utf8');
    expect(html).toContain('href="https://github.com/AbrahamEsquivel/LostNet/releases/latest/download/app-debug.apk"');
    expect(html).toContain('download');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain('Descarga LostNet para Android');
    expect(html).toContain('Escanéalo con tu celular');
    expect(html).toContain('id="descarga-app"');
  });
});
