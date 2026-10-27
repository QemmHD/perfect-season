import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` makes the static site for GitHub Pages (and Vercel).
// `vite build --mode artifact` makes one self-contained page that loads React
// from cdnjs (the artifact host only allows scripts from a few CDNs).

/** Build id shown in Settings and compared against version.json to find new deploys. */
function buildVersion(): string {
  let sha = process.env.GITHUB_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = 'local';
    }
  }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '.');
  return stamp + '-' + sha.slice(0, 7);
}

/** Adds sw.js (offline + auto-update) and version.json to the web build. */
function pwa(version: string): Plugin {
  return {
    name: 'perfect-season-pwa',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      // launch images are fetched by iOS when the app is added to the home screen; no need to cache them
      const own = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map'));
      const shell = ['manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
      const precache = ['./', ...own, ...shell].map((f) => (f === './' ? f : './' + f));
      const sw = readFileSync('pwa/sw.js', 'utf8').replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) + '\n' });
    },
  };
}

export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  const version = buildVersion();
  return {
    base: './',
    plugins: [react({ jsxRuntime: 'classic' }), ...(artifact ? [viteSingleFile()] : [pwa(version)])],
    define: { __APP_VERSION__: JSON.stringify(version) },
    test: { globals: true, environment: 'node', exclude: ['**/node_modules/**', '.claude/**', 'dist/**'] },
    // icons and launch images are for the installed web app, not the single-page artifact
    publicDir: artifact ? false : 'public',
    build: artifact
      ? {
          outDir: 'dist-artifact',
          rollupOptions: {
            external: ['react', 'react-dom', 'react-dom/client'],
            output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' } },
          },
        }
      : { outDir: 'dist' },
  };
});
