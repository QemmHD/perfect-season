// Automatic drafting for the tests: random picks, the best available, or the best available
// with respins when a team has no one good. Used by the calibration and the rule tests.
import { CELL_BY_ID } from './data';
import { botChoose, botPicksFirst, draftReducer, eligibleSlots, isDraftComplete, newDraft, nextCell, noOneFits, whyUnavailable, SLOT_PREFERENCE, type DraftState } from './draft';
import { rng } from './rng';
import type { BotLevel, Mode } from './types';

export type Strategy = 'random' | 'best' | 'smart';

export function autoDraft(strategy: Strategy, seed: number, mode: Mode = 'classic', bot: BotLevel = 'pro', useRespins = false, botFirst = false): DraftState {
  const rand = rng(seed);
  let s = newDraft(mode, bot, mode === 'daily' ? '2026-10-24' : null, botFirst);
  let guard = 0;
  while (!isDraftComplete(s) && guard++ < 60) {
    if (!s.cellId) {
      const nx = nextCell(s, 'spin', rand);
      s = draftReducer(s, { type: 'land', ...nx });
      if (botPicksFirst(s)) {
        const b = botChoose(s, s.cellId!, [], rand);
        if (b) s = draftReducer(s, { type: 'bot', playerId: b.player.id, slot: b.slot, cellId: b.cellId });
      }
      continue;
    }
    if (noOneFits(s)) {
      const nx = nextCell(s, 'nofit', rand);
      s = draftReducer(s, { type: 'land', ...nx, keepBot: true });
      if (mode === '1v1' && botPicksFirst(s)) {
        const b = botChoose(s, s.cellId!, [], rand);
        if (b) s = draftReducer(s, { type: 'bot', playerId: b.player.id, slot: b.slot, cellId: b.cellId });
      }
      continue;
    }
    const cell = CELL_BY_ID[s.cellId];
    const ok = cell.players.filter((p) => whyUnavailable(s, p) === null);
    if (useRespins && strategy !== 'random') {
      const bestVal = Math.max(...ok.map((p) => p.val));
      if (bestVal < 16 && (s.freeTeam > 0 || s.freeEra > 0)) {
        const kind = s.freeTeam > 0 ? 'team' : 'era';
        s = draftReducer(s, { type: 'respin', kind, paid: false });
        const nx = nextCell(s, kind, rand);
        s = draftReducer(s, { type: 'land', ...nx });
        continue;
      }
    }
    if (!s.youDone) {
      const pick = strategy === 'random' ? ok[Math.floor(rand() * ok.length)] : ok.sort((a, b) => b.val - a.val)[0];
      const slots = eligibleSlots(s, pick);
      const slot = SLOT_PREFERENCE.find((x) => slots.includes(x))!;
      s = draftReducer(s, { type: 'place', playerId: pick.id, slot });
      continue;
    }
    if (mode === '1v1' && !s.botDone) {
      const mine = Object.values(s.lineup).filter(Boolean).map((p) => p!.id);
      const b = botChoose(s, s.cellId, mine, rand);
      if (b) s = draftReducer(s, { type: 'bot', playerId: b.player.id, slot: b.slot, cellId: b.cellId });
      else s = { ...s, botDone: true };
      continue;
    }
    s = draftReducer(s, { type: 'endCell' });
  }
  return s;
}
