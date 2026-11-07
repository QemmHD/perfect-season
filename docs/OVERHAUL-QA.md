# Overhaul browser integration verification

Implemented and verified by **Codex (OpenAI), 2026-11-07**. Reproducible source: `scripts/qa/overhaul.mjs`, using the existing isolated `scripts/qa/browser.mjs` fixture. This complements the focused Cup/state tests, manual-control/feedback QA and performance/offline verification documented by their respective changes.

## Completed integration checks

| Check | NBA | NFL | Soccer |
| --- | --- | --- | --- |
| Play page and Cup page at 320px / 390px, no horizontal overflow or header/wallet collision | Pass | Pass | Pass |
| Quick Play / Runs filters and Club Cups discovery | Pass | Pass | Pass |
| Rookie selection, Open Cup entry and saved round-zero reload | Pass | Pass | Pass |
| One actual full Cup match through the existing engines, using test-only autoplay at 8× | Win | Win | Win |
| Match breakdown displayed from completed match outcomes | Pass | Pass | Pass |
| Actual round/result/wallet persisted through reload | Pass | Pass | Pass |
| Explicit three-win presentation fixture → title reward → reload cannot claim it again | Pass | Pass | Pass |
| Original owned copy UID/card-ID retained, levels/XP only increase through normal rewards | 56 copies | 69 copies | 40 copies |
| Browser page errors | 0 | 0 | 0 |

An additional **actual NBA Rookie Squad Battles rung-four match**, starting from an explicitly seeded ladder position, earned its Bronze Pack. **View Reward Packs** on the result screen opened the Store and exposed that exact pending pack. This exercises the new result-to-reward navigation through the real App state owner.

The played Cup matches committed the normal win payment of 60 coins. Each seeded completed Open Cup title committed exactly 200 coins and one Gold Pack. Subsequent reload retained the claim receipt, no active completed run and no duplicate payout. The test changes no existing player account, canonical card ID, serial or live leaderboard. All browser contexts are fresh test profiles using `ns=inspect` and localhost relay selection.

## Evidence and reproduction

Execution artifacts: `/tmp/perfect-season-overhaul-qa/`, including `overhaul-report.json`, per-sport Play/Cup 320/390 captures, actual match results, seeded title screens and the earned NBA reward-pack result. The root audit/release documentation links selected committed screenshots.

Run after starting the current source with `npm run dev -- --host 0.0.0.0 --port 5180`:

```sh
PS_QA_URL=http://localhost:5180 \
PS_QA_PACKAGE_JSON=/workspace/perfect-season-qa-tools/package.json \
PS_QA_PROXY=http://proxy:8080 \
PS_QA_ARTIFACTS=/tmp/perfect-season-overhaul-qa \
node scripts/qa/overhaul.mjs
```

`PS_OVERHAUL_SPORT=nba` (or `nfl` / `soccer`) limits the run. The package path identifies the existing external Playwright installation, not a new game dependency. Use the current execution environment's inherited proxy when different. Test profiles are limited to localhost by `browser.mjs`.

The 8× override patches the actual transformed React module used by Arcade and matches sport component names, so it survives dev-module query hashes and lazy loading. This changes test speed only. The test verifies that its override actually touched game components; normal game builds remain at normal speed. Run heavy builds/tests and Chromium serially in constrained environments: an initial parallel attempt exceeded environment resources, without reproducing an application error.

## Verification limits

These are automated production-engine games, not human playtests or completed three-match championship runs. The title/claim screen is an explicitly seeded presentation fixture after the actual match; the script never claims three played wins. Difficulty comparison, malformed/stale request rejection and repeated weekly title claims are covered by the pure Cup/settlement tests. Native iPhone installation, real two-phone H2H and owner-signed gifting remain device/account acceptance checks. This integration script sends no owner gift and publishes no live score.
