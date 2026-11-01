// Implemented by Codex. Identity, active-count and offline disposal regressions.
import { describe, expect, it } from 'vitest';
import { mergeCounts } from './circulation';
import { applyCopyReplies, numberedEligibility } from './numbered-sync';
import { freshUt, migrateUt } from './state';
import { removeCards } from './storage';
import type { CopyReply } from './registry';
const card = { uid: 'original-uid', cardId: 'nba:season:2024:test:CHI', level: 4, xp: 82, at: 1 };
const mint = { serial: 12, totalAtPull: 32, activeAtPull: 31, requestId: '12345678-1234-4234-8234-123456789abc', namespace: 'inspect' };
const reply: CopyReply = { uid: card.uid, cardId: card.cardId, mint, retired: false, active: 31, revision: 3 };
describe('90+ worldwide circulation', () => {
  it('accepts a smaller live total, including zero and totals below the fixed issue number', () => {
    const current = { counts: { edition: 32 }, versions: { edition: 2 }, fresh: true };
    const next = mergeCounts(current, { edition: 11 }, { edition: 3 });
    expect(next.counts.edition).toBe(11);
    expect(mergeCounts(next, { edition: 32 }, { edition: 2 }).counts.edition).toBe(11);
    expect(mergeCounts(next, { edition: 0 }, { edition: 4 }).counts.edition).toBe(0);
  });
  it('assigns metadata without changing UID, levels, XP or squad, and retries cannot overwrite a serial', () => {
    const ut = { ...freshUt(), owned: [card], squad: { PG: card.uid } };
    const updated = applyCopyReplies(ut, [reply]);
    expect(updated.owned[0]).toEqual({ ...card, mint });
    expect(updated.squad).toEqual(ut.squad);
    expect(applyCopyReplies(updated, [{ ...reply, mint: { ...mint, serial: 99 } }]).owned[0].mint?.serial).toBe(12);
    expect(applyCopyReplies({ ...ut, owned: [] }, [reply]).owned).toEqual([]);
  });
  it('persists exact sold/SBC copy removals for offline retry and acknowledges only those actually retired', () => {
    for (const reason of ['sold', 'sbc'] as const) {
      const original = {
        ...freshUt(),
        owned: [
          { ...card, mint },
          { ...card, uid: 'keep' },
        ],
        squad: { PG: card.uid },
      };
      const removed = removeCards(original, [card.uid], reason);
      const restored = migrateUt(JSON.parse(JSON.stringify(removed)));
      expect(restored.owned.map((c) => c.uid)).toEqual(['keep']);
      expect(restored.retirements).toHaveLength(1);
      expect(restored.retirements?.[0]).toMatchObject({ uid: card.uid, reason, mint });
      expect(applyCopyReplies(restored, [{ ...reply, retired: true }]).retirements).toEqual([]);
      expect(applyCopyReplies(restored, [reply]).retirements).toHaveLength(1);
    }
  });
  it('includes all eligible tiers and upgrades rather than just GOAT/Spotlight', async () => {
    for (const sport of ['nba', 'nfl'] as const) {
      const ids = await numberedEligibility(sport);
      expect(Object.keys(ids).length).toBeGreaterThan(3000);
      expect(Object.keys(ids).some((id) => id.includes(':season:'))).toBe(true);
      expect(Object.values(ids).some((level) => level > 1)).toBe(true);
      expect(Object.values(ids).every((level) => level >= 1 && level <= 5)).toBe(true);
    }
  });
});
