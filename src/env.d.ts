/** Set by vite.config.ts: build time and commit, e.g. "20261024.2105-9d52b2b". */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
