import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
      // Codex: large sport-only data is fetched on first use, not downloaded for every sport at
      // install. Runtime cacheFirst retains used files; update.ts also warms pre-worker startup assets.
      // Keep NBA/NFL attrs in install: a first offline draft match must retain its real ratings.
      // Classify using Rollup's source module IDs, never the emitted filename/chunk name.
      // Claude review 2026-11-08: the NBA/NFL draft datasets stay in install too. The page awaits its
      // sport's dataset before anything renders, so an offline switch to a sport not yet opened on this
      // build was a blank screen (main precached both). Only the selected one is still parsed at startup.
      const onDemandModule = /[\\/](?:game[\\/]soccer2[\\/]|game[\\/]pixel[\\/]pitch\.ts|data[\\/](?:cards-(?:nba|nfl|soccer)|soccer)\.json)/;
      const onDemand = (f: string) => {
        const o = bundle[f];
        if (o.type === 'asset') return /(^|[\\/])soccer-[^\\/]*\.mp3$/.test(f);
        return o.moduleIds.length > 0 && o.moduleIds.every((id) => onDemandModule.test(id));
      };
      const optional = new Set(Object.keys(bundle).filter(onDemand));
      const own = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map') && !optional.has(f));
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
    define: { __APP_VERSION__: JSON.stringify(version), __SOCCER__: JSON.stringify(!artifact) },
    // Claude 2026-11-01: the artifact build is one IIFE, which can't hold soccer's lazily loaded data
    // (a top-level await in engine/soccer-raw.ts): it swaps in a stub and plays NBA/NFL only
    resolve: artifact
      ? {
          alias: [
            { find: /^\.\/sport-raw$/, replacement: fileURLToPath(new URL('./src/engine/sport-raw.artifact.ts', import.meta.url)) },
            { find: /^\.\/soccer-raw$/, replacement: fileURLToPath(new URL('./src/engine/soccer-raw.artifact.ts', import.meta.url)) },
            { find: /^(\.\.?\/)+soccer-lazy$/, replacement: fileURLToPath(new URL('./src/soccer-lazy.artifact.ts', import.meta.url)) },
          ],
        }
      : undefined,
    test: { globals: true, environment: 'node', testTimeout: 30000, hookTimeout: 120000, exclude: ['**/node_modules/**', '.claude/**', 'dist/**'] },
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
      : // Claude 2026-11-01: es2022 for the top-level await that keeps soccer data out of the main chunk
        // (iOS Safari 15+)
        { outDir: 'dist', target: ['es2022', 'safari15', 'chrome89', 'firefox89', 'edge89'] },
  };
});
