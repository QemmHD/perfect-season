// The admin panel (Settings, at the bottom): behind a password, tools for this phone's game: coins,
// XP, boosters, Ultimate Team packs and limits, the day's Daily, missions and reward. The game has
// no server, so nothing here reaches anyone else's game. Only a hash of the password is kept here
// (the page's code is public).
import React, { useState } from 'react';
import { BOOSTER_NAMES, levelInfo } from '../engine/economy';
import { NFL, SPORT } from '../engine/sport';
import { BOOSTERS } from '../engine/types';
import { newId, type Profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { packDefs } from '../ut/packs';
import { Sheet } from './common';

const SALT = 'perfect-season-admin:';
const HASH = '01b2ee9470d567ddc95f25e828db84a8534a8ac7fd93bc9d46db6a593f8686e1';
/** unlocked for the rest of the visit */
const KEY = 'ps-admin';
/** wrong tries in a row before a wait, and the wait */
const TRIES = 5;
const WAIT_MS = 30000;

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

/** The password, with or without its full stop. */
async function matches(pw: string): Promise<boolean> {
  const data = new TextEncoder().encode(SALT + pw.trim().replace(/\.$/, ''));
  return hex(await crypto.subtle.digest('SHA-256', data)) === HASH;
}

function unlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function remember(on: boolean) {
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    // no storage: unlocked until the sheet closes
  }
}

let fails = 0;
let waitUntil = 0;

export function AdminSheet({ profile, update, onToast, onClose }: { profile: Profile; update: (fn: (p: Profile) => Profile) => void; onToast: (t: string) => void; onClose: () => void }) {
  const [open, setOpen] = useState(unlocked);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [coins, setCoins] = useState('');
  const secure = typeof crypto !== 'undefined' && !!crypto.subtle;

  const tryUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < waitUntil) return setMsg('Too many tries. Wait a few seconds.');
    if (!(await matches(pw))) {
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
    remember(true);
    setOpen(true);
    setMsg('');
  };

  /** Make a change and say what it did. */
  const act = (text: string, fn: (p: Profile) => Profile) => {
    sfx.coin();
    update(fn);
    onToast(text);
  };
  const addCoins = (n: number) => act('+' + n.toLocaleString('en-US') + ' coins', (p) => ({ ...p, coins: p.coins + n }));
  const lv = levelInfo(profile.xp);
  // (a position pack is bought for a position: not one to hand out blind)
  const packs = Object.values(packDefs(SPORT)).filter((d) => d.kind !== 'position');
  const pending = profile.ut.packs.length;

  return (
    <Sheet label="Admin" onClose={onClose}>
      {(close) =>
        !open ? (
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
                  <button type="submit" className="btn primary" disabled={!pw}>
                    UNLOCK
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
            <p className="note">Changes this phone’s game only.</p>

            <section className="admin-sec">
              <span className="eyebrow">Coins · {profile.coins.toLocaleString('en-US')}</span>
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
                  const n = Math.max(0, Math.min(99999999, Math.floor(Number(coins))));
                  if (!Number.isFinite(n) || coins.trim() === '') return;
                  act('Coins set to ' + n.toLocaleString('en-US'), (p) => ({ ...p, coins: n }));
                  setCoins('');
                }}
              >
                <input className="admin-num" inputMode="numeric" placeholder="Set coins to…" value={coins} onChange={(e) => setCoins(e.target.value.replace(/[^\d]/g, ''))} />
                <button type="submit" className="btn" disabled={!coins}>
                  SET
                </button>
              </form>
            </section>

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
                Ultimate Team ({NFL ? 'football' : 'basketball'}) · {pending} {pending === 1 ? 'pack' : 'packs'} waiting in the Store
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
                  remember(false);
                  setOpen(false);
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
