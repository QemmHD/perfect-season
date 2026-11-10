// Claude (packs-1, 2026-11-10): where the packs measurement scripts write. Set PACKS_OUT to the team's
// measurement folder and PACKSIM_LABEL to the run's name (before, after-packs-2, final, ...):
//   PACKS_OUT=<dir> PACKSIM_LABEL=before PS_SPORT=nba npx vite-node scripts/packs/packsim.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const LABEL = process.env.PACKSIM_LABEL ?? 'dev';

export function outDir(): string {
  const dir = join(process.env.PACKS_OUT ?? join(tmpdir(), 'packs-out'), LABEL);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeOut(name: string, data: unknown): string {
  const file = join(outDir(), name);
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 1));
  return file;
}
