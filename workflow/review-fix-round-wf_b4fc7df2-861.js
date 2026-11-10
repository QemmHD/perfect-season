export const meta = {
  name: 'review-fix-round',
  description: 'Review the fix round (96d5c0c..bf23350) in four areas, then adversarially verify the serious findings',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const REPO = '/home/user/perfect-season'
const BASE = `You are reviewing one commit of a Vite + React + TypeScript game, "Perfect Season" (NBA and NFL draft game; one sport per page load via src/engine/sport.ts; tests: \`npm test\` runs vitest for both sports, PS_SPORT=nfl for football). Repo: ${REPO}. The commit under review is bf23350 ("Fix what the review of the football update found"); diff it with \`git -C ${REPO} diff 96d5c0c bf23350\` and read the commit message for intent. Do NOT edit any file in the repo and do not commit; write any scratch scripts under /tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/review2/ (create it). Cached raw data sources are in ${REPO}/.cache/nfl (fdp = PFR season tables 1970-2021, wk = nflverse weekly stats 1999-2025, rs = season rosters, rw = weekly rosters 2002-2025, players.csv register, games.csv, nfl_games.csv). Report only real defects you can tie to a concrete input or state and a wrong output, crash or broken promise — regressions this commit introduced, or things it claims to fix but doesn't. No style nits. For each finding give a concrete failure scenario, the file and line, and a proposed fix. Rate severity honestly (high = wrong results most players see or broken core flow; medium = wrong in a real but narrower case; low = minor). If you find nothing real, return an empty list.`

const DIMS = [
  { key: 'data', prompt: `${BASE}\n\nYour area: the football DATA pipeline changes in scripts/nfl_sources.py and scripts/build_nfl_data.py and the regenerated src/data/nfl.json. Re-run the build into a scratch copy if useful (e.g. copy the scripts to your scratch dir and point OUT elsewhere, or run python3 with a wrapper that sets build_nfl_data.OUT) — never overwrite src/data/nfl.json. Check each claimed fix actually works and look hard for regressions it introduced: (1) 1999-2021 one-team seasons replaced by the PFR row — wrong Register matches (namesakes, a PFR row attached to the wrong nflverse id), seasons where PFR and nflverse disagree badly, rows dropped, QB starts (gs) semantics changing eligibility; (2) games from weekly-roster ACT counts for non-QBs 2002-2025 (team code mapping ROSTER_CODES, double counting, traded players, players whose roster position differs); (3) season-roster positions (players who vanished from cells, e.g. Taysom Hill now a QB and gone — is that correct by the data? any star who vanished or changed position wrongly?); (4) the JAX 2001-02 single-label game fix (any other game wrongly flipped?); (5) settle_ids chaining (any two real different people merged?); (6) xTM rows added to league totals and career rates (double counting? stats with wrong scale?); (7) the QuantileMap tail above the 98th percentile (monotone? continuous at the joint? any value above 30.33 or a jump?); (8) defense naming and prime refs. Compare the new nfl.json against the previous one (\`git -C ${REPO} show 96d5c0c:src/data/nfl.json\`) for big unexplained changes: famous players (Rice, Montana, Brady, Manning, Mahomes, Payton, Sanders, Faulk, Moss, Gonzalez, Gronkowski, Kelce) and the list sizes per cell.` },
  { key: 'engine', prompt: `${BASE}\n\nYour area: the football ENGINE and calibration: src/engine/rating.ts (new NFL_BENCHMARK, NFL_CURVE, the [133,17] anchor), src/engine/playoffs.ts (SERIES_K 10), src/engine/draft.ts (trade dup rule for NFL), src/engine/nfl.test.ts. Verify the calibration claims by running \`CALIB=1 PS_SPORT=nfl npx vitest run src/engine/sim.test.ts\` and \`PS_SPORT=nfl npx vitest run src/engine/sim.test.ts\` from ${REPO} (these only read code). Check winsFromRating/ratingForWins invert for every integer 0..17, grade tiers, the 17-0 odds docs (14-win ~28%, minimal 17-0 ~64%), the draft trade rule (can it ever let one person be held twice? does it interact badly with Prime, Double, the bot, or H2H validation in src/net?), and whether any NBA behaviour changed (NBA must be byte-for-byte the same in rules and data fingerprint DATA_V in src/engine/version.ts).` },
  { key: 'app', prompt: `${BASE}\n\nYour area: the APP and ONLINE changes: src/App.tsx (room tracked as {code, hosting} with Search's onRoom, the didn't-connect timer going back to the room, flushLb sending the other sport's queue via readOtherLb/updateOtherLb in src/lib/profile.ts, the mount-time tidy of the other sport's entries, renames updating both sports, goSport waiting for lingerUntil), src/net/leaderboard.ts (prune now matching by tag suffix — could it now keep or drop the wrong entries for either sport?), src/net/match.ts (presence beats carry sp; OnlineCount.here; old clients without sp counted as NBA), src/ui/Pages.tsx (LIVE badge), src/ui/Search.tsx (Room type, onRoom effect, mismatch with an 'at' time expiring after 6s). Trace real flows: a friend room host whose match doesn't connect; a joiner via invite link; cancelling a room then quick match then a failed connect; a rename in NBA while NFL has queued entries; storage blocked; both sports' profiles missing; a stale render loop from the onRoom effect (props.onRoom identity changes each render?).` },
  { key: 'screen', prompt: `${BASE}\n\nYour area: SCREEN FIT and UI: src/styles.css (the standalone body overflow rule moved after the base body rule — confirm by computed style in Chromium with an emulated display-mode: standalone if you can, e.g. Playwright's page.emulateMedia does not cover display-mode, so reason from the cascade; check nothing else now overrides it), src/stage.tsx (re-layout once per launch, viewportInfo insets), src/ui/Season.tsx (the qualify line hidden when unbeaten), the new .fit-tight/.fit-compact .sched and .unbeaten rules, .lbline i min-width, the .radar-wrap.noted rules, src/ui/sportui.ts (sortValue td/yds and hotFor), src/lib/share.ts lastName now shared by src/ui/common.tsx and cardName (does any NBA or NFL name now render wrongly? check all names in src/data/nba.json and src/data/nfl.json for odd results, e.g. names ending in 'Jr.' with particles, single-word names, 'De' as a first name), src/ui/Welcome.tsx. A dev server for the working tree runs at http://localhost:4190/ (add ?sport=nfl for football); Chromium + Playwright are preinstalled (require('playwright')). You may drive it, but don't stop or restart any server.` },
]

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          line: { type: 'number' },
          scenario: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['title', 'severity', 'file', 'scenario', 'fix'],
      },
    },
  },
  required: ['findings'],
}
const VERDICT = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['real', 'reason'],
}

phase('Review')
const reviews = await parallel(DIMS.map((d) => () => agent(d.prompt, { label: 'review-' + d.key, phase: 'Review', schema: FINDINGS })))
const rank = { high: 0, medium: 1, low: 2 }
const all = reviews
  .map((r, i) => (r ? r.findings.map((f) => ({ ...f, dim: DIMS[i].key })) : []))
  .flat()
  .sort((a, b) => rank[a.severity] - rank[b.severity])
const MAX_VERIFY = 6
const toVerify = all.slice(0, MAX_VERIFY)
if (all.length > MAX_VERIFY) log(`${all.length - MAX_VERIFY} lower-ranked findings not verified (reported unverified)`)

phase('Verify')
const verdicts = await parallel(
  toVerify.map((f, i) => () =>
    agent(
      `${BASE}\n\nA reviewer reported this defect in the commit. Try hard to REFUTE it: reproduce it concretely (run code, read the data, trace the flow). If you cannot show the failing path really happens, or the effect is negligible, say real=false. Default to real=false if uncertain. Explain exactly what you checked.\n\nFinding (${f.severity}, area ${f.dim}): ${f.title}\nFile: ${f.file}:${f.line ?? ''}\nScenario: ${f.scenario}\nProposed fix: ${f.fix}`,
      { label: 'verify-' + f.dim + '-' + (i + 1), phase: 'Verify', schema: VERDICT }
    ).then((v) => ({ ...f, verdict: v }))
  )
)
const done = verdicts.filter(Boolean)
return {
  confirmed: done.filter((f) => f.verdict && f.verdict.real),
  refuted: done.filter((f) => !f.verdict || !f.verdict.real).map((f) => ({ title: f.title, dim: f.dim, reason: f.verdict ? f.verdict.reason : 'no verdict' })),
  unverified: all.slice(MAX_VERIFY),
}
