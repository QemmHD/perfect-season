import { DATA_V } from '../engine/version';
import { SPORT } from '../engine/sport';
import { getPublicKey } from 'nostr-tools/pure';

export const SAVE_WARNING = 'ps:save-warning';
export function saveWarning() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(SAVE_WARNING));
}
export const checkpointKey = (sport = SPORT) =>
  'perfect-season:checkpoint:' + sport;
export interface Checkpoint<T> {
  v: 1;
  data: string;
  sport: string;
  at: number;
  screen: 'draft' | 'reveal' | 'playoffs';
  run: T;
}
function checkpointShape(c: any, sport: string): boolean {
  const slots =
    sport === 'nfl'
      ? ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DL', 'LB', 'DB']
      : ['PG', 'SG', 'SF', 'PF', 'C'];
  const r = c?.run,
    d = r?.draft;
  if (
    !c ||
    c.v !== 1 ||
    c.sport !== sport ||
    !['draft', 'reveal', 'playoffs'].includes(c.screen) ||
    !r ||
    !['classic', 'blind', 'daily'].includes(r.mode) ||
    typeof r.saveId !== 'string' ||
    !Number.isFinite(r.id) ||
    !d ||
    d.mode !== r.mode ||
    !d.lineup ||
    !Array.isArray(d.used) ||
    !Array.isArray(d.log)
  )
    return false;
  if (
    !['freeTeam', 'freeEra', 'ptr', 'picksLeft', 'cellsDone'].every(
      (k) => Number.isFinite(d[k]) && d[k] >= 0
    )
  )
    return false;
  if (
    !slots.every(
      (k) =>
        k in d.lineup &&
        (d.lineup[k] === null ||
          (typeof d.lineup[k]?.id === 'string' &&
            typeof d.lineup[k]?.name === 'string' &&
            Array.isArray(d.lineup[k]?.pos)))
    )
  )
    return false;
  if (
    c.screen !== 'draft' &&
    (!r.season ||
      !Array.isArray(r.season.seq) ||
      r.season.seq.length !== (sport === 'nfl' ? 17 : 82) ||
      !Number.isFinite(r.season.wins))
  )
    return false;
  if (
    c.screen === 'playoffs' &&
    (!Array.isArray(r.bracket) ||
      r.bracket.length !== 4 ||
      !r.bracket.every(
        (s: any) =>
          s && s.opp && typeof s.opp.team === 'string' && Array.isArray(s.games)
      ))
  )
    return false;
  return true;
}
export function readCheckpoint<T>(): Checkpoint<T> | null {
  try {
    const c = JSON.parse(localStorage.getItem(checkpointKey()) ?? 'null');
    if (c?.data !== DATA_V || !checkpointShape(c, SPORT)) return null;
    return c;
  } catch {
    return null;
  }
}
export function writeCheckpoint<T>(
  run: T,
  screen: Checkpoint<T>['screen']
): boolean {
  try {
    localStorage.setItem(
      checkpointKey(),
      JSON.stringify({
        v: 1,
        data: DATA_V,
        sport: SPORT,
        at: Date.now(),
        screen,
        run,
      })
    );
    return true;
  } catch {
    saveWarning();
    return false;
  }
}
export function clearCheckpoint() {
  try {
    localStorage.removeItem(checkpointKey());
  } catch {
    saveWarning();
  }
}
const KEYS = [
  'perfect-season:profile:v1',
  'perfect-season:profile:nfl:v1',
  'perfect-season:key:v1',
  'perfect-season:fav',
  'perfect-season:fav:asked',
  'perfect-season:sport',
  'perfect-season:checkpoint:nba',
  'perfect-season:checkpoint:nfl',
  'perfect-season:training:nba',
  'perfect-season:training:nfl',
];
const enc = new TextEncoder();
const b64 = (b: Uint8Array) =>
  btoa(Array.from(b, (n) => String.fromCharCode(n)).join(''));
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function key(password: string, salt: Uint8Array, usage: KeyUsage[]) {
  if (password.length < 8)
    throw new Error('Use a password with at least 8 characters.');
  const base = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 210000,
      hash: 'SHA-256',
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}
export async function createBackup(password: string): Promise<string> {
  const values = Object.fromEntries(
    KEYS.map((k) => [k, localStorage.getItem(k)])
  );
  // A backup is progress recovery, never a replay of a live online session.
  for (const k of KEYS.slice(0, 2)) {
    if (values[k]) {
      const p = JSON.parse(values[k]!);
      p.activeMatch = null;
      values[k] = JSON.stringify(p);
    }
  }
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(password, salt, ['encrypt']),
    enc.encode(JSON.stringify(values))
  );
  return JSON.stringify({
    app: 'perfect-season',
    v: 1,
    at: Date.now(),
    salt: b64(salt),
    iv: b64(iv),
    cipher: b64(new Uint8Array(cipher)),
  });
}
export interface BackupPreview {
  values: Record<string, string | null>;
  name: string;
  coins: number;
  cards: number;
  at: number;
}
export async function openBackup(
  raw: string,
  password: string
): Promise<BackupPreview> {
  if (raw.length > 16_000_000) throw new Error('This backup is too large.');
  let data: Record<string, string | null>, o: any;
  try {
    o = JSON.parse(raw);
    if (o.app !== 'perfect-season' || o.v !== 1) throw new Error();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(o.iv) },
      await key(password, bytes(o.salt), ['decrypt']),
      bytes(o.cipher)
    );
    data = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error(
      'Couldn’t unlock this backup. Check the file and password.'
    );
  }
  if (
    !data ||
    typeof data !== 'object' ||
    Object.keys(data).some((k) => !KEYS.includes(k)) ||
    KEYS.some((k) => data[k] !== null && typeof data[k] !== 'string')
  )
    throw new Error('The backup is incomplete or invalid.');
  const nba = JSON.parse(data[KEYS[0]] ?? 'null'),
    nfl = JSON.parse(data[KEYS[1]] ?? 'null');
  for (const p of [nba, nfl])
    if (
      p &&
      (p.v !== 1 ||
        !Array.isArray(p.history) ||
        !p.ut ||
        !Array.isArray(p.ut.owned) ||
        !Number.isFinite(p.coins ?? nba?.coins) ||
        (p.coins ?? 0) < 0)
    )
      throw new Error('The saved progress is invalid.');
  if (!nba) throw new Error('This backup has no player profile.');
  for (const sport of ['nba', 'nfl']) {
    const raw = data['perfect-season:checkpoint:' + sport];
    if (raw && !checkpointShape(JSON.parse(raw), sport))
      throw new Error('The unfinished run in this backup is invalid.');
  }
  if (nba.name !== null && typeof nba.name !== 'string')
    throw new Error('The player name is invalid.');
  if (
    !Number.isFinite(nba.xp) ||
    nba.xp < 0 ||
    !nba.inventory ||
    !nba.settings ||
    !nba.lb
  )
    throw new Error('The player profile is incomplete.');
  const sk = data['perfect-season:key:v1'];
  if (sk) {
    if (!/^[a-f0-9]{64}$/.test(sk))
      throw new Error('The player identity is invalid.');
    getPublicKey(Uint8Array.from(sk.match(/../g)!, (s) => parseInt(s, 16)));
  }
  return {
    values: data,
    name: nba.name ?? 'Player',
    coins: nba.coins,
    cards: (nba.ut?.owned.length ?? 0) + (nfl?.ut?.owned.length ?? 0),
    at: o.at,
  };
}
/** All writes are prepared before replacement; roll back on storage failure. */
export function restoreBackup(preview: BackupPreview) {
  const before = KEYS.map((k) => [k, localStorage.getItem(k)] as const);
  try {
    for (const k of KEYS) {
      const v = preview.values[k];
      v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    }
  } catch {
    for (const [k, v] of before) {
      try {
        v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
      } catch {
        /* report original failure */
      }
    }
    throw new Error(
      'There wasn’t enough storage to restore. Your previous save was kept where possible.'
    );
  }
}
