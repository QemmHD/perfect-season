// Admin gifts: only the admin's signed gifts count, what's in them is checked and capped, and each
// is collected once.
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { freshProfile } from '../lib/profile';
import { withGift } from '../ui/Admin';
import { ADMIN_PUBKEY, contentOf, giftEvent, giftOf, MAX_GIFT_COINS, MAX_GIFT_PACKS } from './gifts';

const sk = generateSecretKey();
const pk = getPublicKey(sk);

describe('admin gifts', () => {
  it('takes a gift only from the admin key', () => {
    const e = giftEvent(sk, ['ab'.repeat(32)], { coins: 500, packs: { gold: 1 }, note: 'hi' }, 'abc123');
    // signed by some other key: not the admin's
    expect(pk).not.toBe(ADMIN_PUBKEY);
    expect(giftOf(e)).toBeNull();
    // the same check against the key that did sign it
    expect(giftOf(e, pk)).toEqual({ id: 'admin:abc123', coins: 500, packs: { gold: 1 }, note: 'hi', at: e.created_at });
  });

  it('addresses players by key, or everyone', () => {
    const one = giftEvent(sk, ['ab'.repeat(32), 'cd'.repeat(32)], { coins: 1, packs: {}, note: '' }, 'abc123');
    expect(one.tags.filter((t) => t[0] === 'p').map((t) => t[1])).toEqual(['ab'.repeat(32), 'cd'.repeat(32)]);
    const all = giftEvent(sk, 'all', { coins: 1, packs: {}, note: '' }, 'abc124');
    expect(all.tags.some((t) => t[0] === 't' && t[1].startsWith('ps1-gift-all'))).toBe(true);
    expect(all.tags.some((t) => t[0] === 'p')).toBe(false);
  });

  it('checks and caps what is in a gift', () => {
    expect(contentOf({ coins: 0, packs: {} })).toBeNull();
    expect(contentOf({ coins: -5, packs: { gold: -1, ruby: 3 } })).toBeNull();
    expect(contentOf({ coins: 1e12, packs: { premium: 999, silver: 2.5 } })).toEqual({ coins: MAX_GIFT_COINS, packs: { premium: MAX_GIFT_PACKS }, note: '' });
    expect(contentOf({ coins: 10, note: 'x'.repeat(300) })!.note.length).toBe(140);
  });

  it('turns away a malformed one', () => {
    const bad = giftEvent(sk, 'all', { coins: 5, packs: {}, note: '' }, 'abc125');
    expect(giftOf({ ...bad, content: '{not json' }, pk)).toBeNull();
    expect(giftOf({ ...bad, content: JSON.stringify({ id: 'x', coins: 5 }) }, pk)).toBeNull();
    expect(giftOf({ ...bad, tags: bad.tags.filter((t) => t[0] !== 't') }, pk)).toBeNull();
  });

  it('is collected once: the coins, and the packs waiting in the Store', () => {
    const p0 = freshProfile();
    const g = { coins: 2500, packs: { gold: 2, bronze: 1 }, note: '' };
    const p1 = withGift(p0, g, 'admin:abc123');
    expect(p1.coins).toBe(p0.coins + 2500);
    expect(p1.ut.packs.map((x) => x.kind).sort()).toEqual(['bronze', 'gold', 'gold']);
    expect(p1.gifts).toContain('admin:abc123');
    expect(withGift(p1, g, 'admin:abc123')).toBe(p1);
  });
});
