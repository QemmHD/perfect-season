import { GAMES } from '../engine/rating';
import { NFL } from '../engine/sport';
import type { RunRecord } from './profile';

const PICK_EMOJI: Record<string, string> = { b: '🟩', g: '🟩', o: '🟨', r: '🟧', m: '🟥' };

export function shareText(r: RunRecord, dailyNo: number | null): string {
  const game = NFL ? 'Perfect Season NFL' : 'Perfect Season';
  const head = r.mode === 'daily' && dailyNo ? game + ' Daily #' + dailyNo : game;
  const rec = r.wins + '–' + (GAMES - r.wins);
  const names = r.lineup.map((p) => lastName(p.name)).join(' · ');
  // the picks, Wordle style: no spoilers for a Daily someone hasn't played
  const d = r.draft;
  const grid = d ? '\nDraft ' + d.letter + ' ' + [...d.picks].map((c) => PICK_EMOJI[c] ?? '⬜').join('') + (d.par !== undefined ? ' · ' + d.par + '% of par' : '') : '';
  const who = r.mode === 'daily' ? '' : '\n' + names;
  return head + ' · ' + rec + ' · ' + r.grade + ' ' + r.tier + '\n' + r.playoff + grid + who + '\nCan you go perfect?';
}

/** Surnames of more than one word that the particle rule can't tell from a middle name. */
const SURNAMES = ['Randle El', 'Mbah a Moute', 'Bon Salle', 'van Breda Kolff', 'World Peace'];

/** A player's short name: the last name with its St. or Van and without Jr. */
export function lastName(n: string): string {
  const base = n.replace(/\s*\([^)]*\)\s*$/, '');
  const known = SURNAMES.find((x) => base.endsWith(' ' + x));
  if (known) return known;
  const parts = base.split(' ');
  let i = parts.length - 1;
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/.test(parts[i]) && i > 1) i--;
  const before = parts[i - 1];
  return i > 1 && /^(St\.|Van|van|Vander|De|Del|La|Le|Du|Da|Di|Mac)$/.test(before) ? before + ' ' + parts[i] : parts[i];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Native share sheet when the browser allows it (it is blocked inside some embeds). */
export async function nativeShare(text: string, dataUrl: string | null): Promise<boolean> {
  try {
    if (!navigator.share) return false;
    const data: ShareData = { text };
    if (dataUrl && navigator.canShare) {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'perfect-season.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) data.files = [file];
    }
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}
