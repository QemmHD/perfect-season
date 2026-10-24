/** Set by vite.config.ts: build time and commit, e.g. "20261024.2105-9d52b2b". */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly MODE: string;
  /** Supabase project URL for the global leaderboard, e.g. https://abcd.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (publishable) key. It is meant to be public; the database only exposes the leaderboard functions. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
