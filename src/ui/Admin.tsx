// The admin panel (Settings, at the bottom): behind a password. Tools for this phone's game (coins,
// XP, boosters, Ultimate Team packs and limits, the day's Daily, missions and reward), and gifts of
// coins and packs for players: yourself, ones you pick from who's online, a few online at random, or
// everyone. Gifts go out over the relays signed with the admin's key, which comes from the password
// (src/net/gifts.ts): the page's code is public, so only the matching public key is kept in it.
import React, { useEffect, useState } from 'react';
import { BOOSTER_NAMES, levelInfo } from '../engine/economy';
import { NFL, SPORT } from '../engine/sport';
import { BOOSTERS } from '../engine/types';
import { newId, type Profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { adminKey, contentOf, GIFT_PACKS, type GiftContent, type GiftPack, MAX_GIFT_COINS, MAX_GIFT_PACKS, sendGift } from '../net/gifts';
import { onRoster, type OnlinePlayer } from '../net/match';
import { NET_ON } from '../net/nostr';
import { packDefs } from '../ut/packs';
import { Sheet } from './common';

/** the admin's key, kept for the rest of the visit */
const KEY = 'ps-admin';
/** wrong tries in a row before a wait, and the wait */
const TRIES = 5;
const WAIT_MS = 30000;
const MAX_COINS = 99_999_999;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));

function savedKey(): Uint8Array | null {
  try {
    const h = sessionStorage.getItem(KEY);
    return h && /^[0-9a-f]{64}$/.test(h) ? unhex(h) : null;
  } catch {
    return null;
  }
}

function remember(sk: Uint8Array | null) {
  try {
    if (sk) sessionStorage.setItem(KEY, hex(sk));
    else sessionStorage.removeItem(KEY);
  } catch {
    // no storage: unlocked until the sheet closes
  }
}

let fails = 0;
let waitUntil = 0;

const PACK_NAME: Record<GiftPack, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', premium: 'Premium' };

/** "5,000 coins and 2 Gold packs" */
export function giftText(g: GiftContent): string {
  const parts = g.coins ? [g.coins.toLocaleString('en-US') + ' coins'] : [];
  for (const k of GIFT_PACKS) {
    const n = g.packs[k] ?? 0;
    if (n) parts.push(n + ' ' + PACK_NAME[k] + (n === 1 ? ' pack' : ' packs'));
  }
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : (parts[0] ?? '');
}

/** The profile with a gift in it: the coins added, the packs waiting in the Store; once per `id`. */
export function withGift(p: Profile, g: GiftContent, id?: string): Profile {
  if (id && (p.gifts ?? []).includes(id)) return p;
  const at = Date.now();
  const packs = GIFT_PACKS.flatMap((k) => Array.from({ length: g.packs[k] ?? 0 }, () => ({ id: newId(), kind: k, at })));
  return { ...p, coins: p.coins + g.coins, ut: { ...p.ut, packs: [...p.ut.packs, ...packs] }, ...(id ? { gifts: [...(p.gifts ?? []), id] } : {}) };
}

type To = 'me' | 'pick' | 'random' | 'all';

export function AdminSheet({ profile, update, onToast, onClose }: { profile: Profile; update: (fn: (p: Profile) => Profile) => void; onToast: (t: string) => void; onClose: () => void }) {
  const [sk, setSk] = useState(savedKey);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [coins, setCoins] = useState('');
  const secure = typeof crypto !== 'undefined' && !!crypto.subtle;

  const tryUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    if (Date.now() < waitUntil) return setMsg('Too many tries. Wait a few seconds.');
    setChecking(true);
    const key = await adminKey(pw).catch(() => null);
    setChecking(false);
    if (!key) {
      sfx.nope();
      setPw('');
      if (++fails >= TRIES) {
        fails = 0;
        waitUntil = Date.now() + WAIT_MS;
        return setMsg('Too many tries. Wait 30 seconds.');
      }
      return setMsg('Wrong password.');
    }
    fails = 0;
    sfx.select();
    remember(key);
    setSk(key);
    setMsg('');
  };

  /** Make a change and say what it did. */
  const act = (text: string, fn: (p: Profile) => Profile) => {
    sfx.coin();
    update(fn);
    onToast(text);
  };
  const amount = () => {
    const n = Math.floor(Number(coins));
    return coins.trim() !== '' && Number.isFinite(n) ? Math.max(0, Math.min(MAX_COINS, n)) : null;
  };
  const addCoins = (n: number) => act('+' + n.toLocaleString('en-US') + ' coins', (p) => ({ ...p, coins: Math.min(MAX_COINS, p.coins + n) }));
  const lv = levelInfo(profile.xp);
  // (a position pack is bought for a position: not one to hand out blind)
  const packs = Object.values(packDefs(SPORT)).filter((d) => d.kind !== 'position');
  const pending = profile.ut.packs.length;

  return (
    <Sheet label="Admin" onClose={onClose}>
      {(close) =>
        !sk ? (
          <form className="admin" onSubmit={tryUnlock}>
            <h2 className="disp">Admin</h2>
            {secure ? (
              <>
                <label className="admin-pw">
                  <span className="eyebrow">Password</span>
                  <input type="password" value={pw} onChange={(e) => (setPw(e.target.value), setMsg(''))} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus />
                </label>
                {msg && <p className="admin-msg">{msg}</p>}
                <div className="btnrow">
                  <button type="button" className="btn" onClick={() => close()}>
                    CANCEL
                  </button>
                  <button type="submit" className="btn primary" disabled={!pw || checking}>
                    {checking ? 'CHECKING…' : 'UNLOCK'}
                  </button>
                </div>
              </>
            ) : (
              <p className="note">The admin panel needs the game’s secure (https) address.</p>
            )}
          </form>
        ) : (
          <div className="admin">
            <h2 className="disp">Admin</h2>

            <section className="admin-sec">
              <span className="eyebrow">Your coins · {profile.coins.toLocaleString('en-US')}</span>
              <div className="admin-row">
                {[1000, 10000, 100000].map((n) => (
                  <button key={n} className="btn" onClick={() => addCoins(n)}>
                    +{n.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
              <form
                className="admin-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = amount();
                  if (n === null) return;
                  addCoins(n);
                  setCoins('');
                }}
              >
                <input className="admin-num" inputMode="numeric" placeholder="Any amount" value={coins} onChange={(e) => setCoins(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} aria-label="Coins" />
                <button type="submit" className="btn" disabled={!coins}>
                  ADD
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!coins}
                  onClick={() => {
                    const n = amount();
                    if (n === null) return;
                    act('Coins set to ' + n.toLocaleString('en-US'), (p) => ({ ...p, coins: n }));
                    setCoins('');
                  }}
                >
                  SET
                </button>
              </form>
            </section>

            <GiftComposer sk={sk} onSelf={(g) => act('Gift added: ' + giftText(g), (p) => withGift(p, g))} onToast={onToast} />

            <section className="admin-sec">
              <span className="eyebrow">
                Level {lv.level} · {profile.xp.toLocaleString('en-US')} XP
              </span>
              <div className="admin-row">
                <button className="btn" onClick={() => act('Level ' + (lv.level + 1), (p) => ({ ...p, xp: p.xp + (lv.need - lv.into) }))}>
                  +1 LEVEL
                </button>
                <button className="btn" onClick={() => act('+1,000 XP', (p) => ({ ...p, xp: p.xp + 1000 }))}>
                  +1,000 XP
                </button>
              </div>
            </section>

            <section className="admin-sec">
              <span className="eyebrow">Boosters · {BOOSTERS.map((b) => BOOSTER_NAMES[b] + ' ' + profile.inventory[b]).join(' · ')}</span>
              <div className="admin-row">
                <button className="btn" onClick={() => act('+5 of every booster', (p) => ({ ...p, inventory: Object.fromEntries(BOOSTERS.map((b) => [b, (p.inventory[b] ?? 0) + 5])) as Profile['inventory'] }))}>
                  +5 OF EACH
                </button>
              </div>
            </section>

            <section className="admin-sec">
              <span className="eyebrow">
                Your Ultimate Team ({NFL ? 'football' : 'basketball'}) · {pending} {pending === 1 ? 'pack' : 'packs'} waiting in the Store
              </span>
              <div className="admin-row">
                {packs.map((d) => (
                  <button key={d.kind} className="btn" onClick={() => act('A ' + d.name + ' is waiting in the Store', (p) => ({ ...p, ut: { ...p.ut, packs: [...p.ut.packs, { id: newId(), kind: d.kind, at: Date.now() }] } }))}>
                    +{d.name.replace(/ Pack$/, '').toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="admin-row">
                <button className="btn" onClick={() => act('Today’s paid games reset', (p) => ({ ...p, ut: { ...p.ut, paid: { day: '', n: 0 } } }))}>
                  RESET PAID GAMES
                </button>
                <button className="btn" onClick={() => act('Every challenge can be done again', (p) => ({ ...p, ut: { ...p.ut, sbc: { done: {} } } }))}>
                  REDO CHALLENGES
                </button>
              </div>
              <div className="admin-row">
                <button className="btn" onClick={() => act('Squad Battles back to rung 1', (p) => ({ ...p, ut: { ...p.ut, battles: { ...p.ut.battles, cleared: 0, round: 0 } } }))}>
                  RESTART LADDER
                </button>
              </div>
            </section>

            <section className="admin-sec">
              <span className="eyebrow">Today</span>
              <div className="admin-row">
                <button className="btn" onClick={() => act('The Daily can be played again', (p) => ({ ...p, daily: null }))}>
                  REPLAY DAILY
                </button>
                <button className="btn" onClick={() => act('Missions reset', (p) => ({ ...p, missions: null }))}>
                  RESET MISSIONS
                </button>
              </div>
              <div className="admin-row">
                <button className="btn" onClick={() => act('The daily reward can be opened again', (p) => ({ ...p, rewardDay: null }))}>
                  DAILY REWARD AGAIN
                </button>
              </div>
            </section>

            <div className="btnrow">
              <button
                className="btn"
                onClick={() => {
                  remember(null);
                  setSk(null);
                  setPw('');
                }}
              >
                LOCK
              </button>
              <button className="btn primary" onClick={() => close()}>
                DONE
              </button>
            </div>
          </div>
        )
      }
    </Sheet>
  );
}

/** Coins and packs for yourself, players you pick, a few online at random, or everyone. */
function GiftComposer({ sk, onSelf, onToast }: { sk: Uint8Array; onSelf: (g: GiftContent) => void; onToast: (t: string) => void }) {
  const [coins, setCoins] = useState('');
  const [packs, setPacks] = useState<Record<GiftPack, number>>({ bronze: 0, silver: 0, gold: 0, premium: 0 });
  const [note, setNote] = useState('');
  const [to, setTo] = useState<To>(NET_ON ? 'pick' : 'me');
  const [online, setOnline] = useState<OnlinePlayer[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [howMany, setHowMany] = useState(3);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => (NET_ON ? onRoster((r) => setOnline(r.filter((o) => !o.me))) : undefined), []);

  const gift = contentOf({ coins: Number(coins) || 0, packs, note });
  const pickedNow = online.filter((o) => picked.has(o.pubkey));
  const n = Math.min(howMany, online.length);
  const count = to === 'me' ? 1 : to === 'pick' ? pickedNow.length : to === 'random' ? n : 0;
  const ready = !!gift && !busy && (to === 'all' || to === 'me' || count > 0);
  const label = busy ? 'SENDING…' : to === 'me' ? 'GIVE TO ME' : to === 'all' ? 'SEND TO EVERYONE' : 'SEND TO ' + count + (count === 1 ? ' PLAYER' : ' PLAYERS');

  const send = async () => {
    if (!gift || !ready) return;
    if (to === 'me') return onSelf(gift);
    const chosen = to === 'pick' ? pickedNow : to === 'random' ? online.slice().sort(() => Math.random() - 0.5).slice(0, n) : [];
    setBusy(true);
    const ok = await sendGift(sk, to === 'all' ? 'all' : chosen.map((o) => o.pubkey), gift).catch(() => 0);
    setBusy(false);
    if (!ok) {
      sfx.nope();
      onToast('Couldn’t reach the network. Try again.');
      return;
    }
    sfx.coin();
    const who = to === 'all' ? 'everyone' : chosen.map((o) => o.name).join(', ');
    onToast('Gift sent to ' + (to === 'all' ? 'everyone' : chosen.length === 1 ? chosen[0].name : chosen.length + ' players'));
    setLog((l) => [giftText(gift) + ' → ' + who, ...l].slice(0, 6));
    setPicked(new Set());
  };

  const step = (k: GiftPack, d: number) => setPacks((p) => ({ ...p, [k]: Math.max(0, Math.min(MAX_GIFT_PACKS, p[k] + d)) }));
  return (
    <section className="admin-sec admin-gift">
      <span className="eyebrow">Send a gift</span>
      <input className="admin-num" inputMode="numeric" placeholder="Coins (any amount)" value={coins} onChange={(e) => setCoins(String(Math.min(MAX_GIFT_COINS, Number(e.target.value.replace(/[^\d]/g, '').slice(0, 8)) || 0) || ''))} aria-label="Gift coins" />
      <div className="admin-packs">
        {GIFT_PACKS.map((k) => (
          <span key={k} className="admin-pack">
            <b>{PACK_NAME[k]}</b>
            <button className="chip" onClick={() => step(k, -1)} aria-label={'One less ' + PACK_NAME[k] + ' pack'} disabled={!packs[k]}>
              −
            </button>
            <i className="num">{packs[k]}</i>
            <button className="chip" onClick={() => step(k, 1)} aria-label={'One more ' + PACK_NAME[k] + ' pack'}>
              +
            </button>
          </span>
        ))}
      </div>
      <input className="admin-num" placeholder="A note with it (optional)" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />

      <span className="seg admin-to" role="group" aria-label="Send to">
        {(NET_ON ? (['me', 'pick', 'random', 'all'] as To[]) : (['me'] as To[])).map((k) => (
          <button key={k} className={to === k ? 'on' : ''} aria-pressed={to === k} onClick={() => setTo(k)}>
            {k === 'me' ? 'ME' : k === 'pick' ? 'PICK' : k === 'random' ? 'RANDOM' : 'EVERYONE'}
          </button>
        ))}
      </span>
      {to === 'pick' &&
        (online.length ? (
          <div className="admin-online">
            {online.map((o) => (
              <button
                key={o.pubkey}
                className={'admin-player' + (picked.has(o.pubkey) ? ' on' : '')}
                aria-pressed={picked.has(o.pubkey)}
                onClick={() =>
                  setPicked((s) => {
                    const next = new Set(s);
                    if (next.has(o.pubkey)) next.delete(o.pubkey);
                    else next.add(o.pubkey);
                    return next;
                  })
                }
              >
                <b>{o.name}</b>
                <small>
                  {o.sport === 'nfl' ? 'Football' : 'Basketball'} · {o.st === 'match' ? 'in a match' : o.st === 'queue' ? 'searching' : 'in the menus'}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="note">Nobody else is online right now. EVERYONE reaches players the next time they open the game.</p>
        ))}
      {to === 'random' && (
        <div className="admin-row admin-random">
          <button className="chip" onClick={() => setHowMany((h) => Math.max(1, h - 1))} aria-label="Fewer">
            −
          </button>
          <b className="num">{n}</b>
          <button className="chip" onClick={() => setHowMany((h) => Math.min(Math.max(1, online.length), h + 1))} aria-label="More">
            +
          </button>
          <span className="note">of {online.length} online now, picked at random</span>
        </div>
      )}
      {to === 'all' && <p className="note">Every player who opens the game in the next two weeks gets it, once.</p>}
      {gift && <p className="admin-sends">Sends {giftText(gift)}{gift.note ? ', with your note' : ''}.</p>}
      <button className="btn gold" disabled={!ready} onClick={send}>
        {label}
      </button>
      {log.length > 0 && (
        <div className="admin-log">
          {log.map((l, i) => (
            <small key={i}>{l}</small>
          ))}
        </div>
      )}
    </section>
  );
}
