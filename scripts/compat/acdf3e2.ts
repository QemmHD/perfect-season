// Claude, 2026-11-10 (studio overhaul, team ut): the live build's source (acdf3e2, main on
// 2026-11-08), unpacked outside the repo so a script can load a save exactly the way a phone that
// has not updated yet does. Never committed: it is extracted on first use with `git archive`.
//   PS_COMPAT_DIR  where to unpack (default: <tmp>/perfect-season-compat); the tree lands in
//                  <PS_COMPAT_DIR>/acdf3e2, with node_modules linked to this checkout's.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OLD_REF = 'acdf3e2';
export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The old tree's `src` folder, unpacked if it isn't yet. */
export function oldSrc(): string {
  const root = join(process.env.PS_COMPAT_DIR || join(tmpdir(), 'perfect-season-compat'), OLD_REF);
  const sha = execFileSync('git', ['rev-parse', OLD_REF + '^{commit}'], { cwd: REPO }).toString().trim();
  const marker = join(root, '.source-commit');
  if (!existsSync(marker) || readFileSync(marker, 'utf8').trim() !== sha) {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    // src, plus the one file outside it that src imports at runtime (the admin pack voucher type is
    // type-only, but the old tree must resolve exactly as it did)
    const tar = execFileSync('git', ['archive', '--format=tar', sha, 'src', 'supabase/functions/card-registry', 'package.json'], {
      cwd: REPO,
      maxBuffer: 1 << 30,
    });
    execFileSync('tar', ['-x', '-C', root], { input: tar });
    symlinkSync(join(REPO, 'node_modules'), join(root, 'node_modules'), 'dir');
    writeFileSync(marker, sha + '\n');
  }
  return join(root, 'src');
}

export { MemoryStorage, useStorage } from '../../src/ut/compat/memory-storage';
