export const meta = {
  name: 'fit-and-perfect',
  description: 'Research the iOS home-screen viewport-height bug, diagnose the stage fitting code, and review the NFL update with adversarial verification',
  phases: [
    { title: 'Research', detail: 'iOS standalone PWA viewport height bug: causes and fixes' },
    { title: 'Diagnose', detail: 'trace stage.tsx + CSS against the real-device numbers' },
    { title: 'Review', detail: 'four dimensions of the NFL update' },
    { title: 'Verify', detail: 'one skeptic per finding' },
  ],
}

const REPO = '/home/user/perfect-season'
const CONTEXT = `Project: "Perfect Season", a Vite + React 18 + TypeScript mobile web game (installable PWA, deployed to GitHub Pages at https://qemmhd.github.io/perfect-season/). Repo: ${REPO} (read-only for you: do NOT edit, commit, or run long/heavy processes; reading files, git log/diff/show, grep and small python/node one-liners are fine).
The app draws a 390px-wide design frame scaled to the screen width (src/stage.tsx). Screens adapt to the frame height with classes fit-compact/tight/normal/roomy. index.html uses <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"> and apple-mobile-web-app-status-bar-style = black-translucent, apple-mobile-web-app-capable = yes. Styles are in src/styles.css (look for .viewport, .stage, .inset-probe, html, body).`

const DEVICE = `Real-device report (iPhone 15 Pro Max, 430x932 pt, installed to the home screen = standalone mode, current live build): the user says "the ui doesn't fit the screen properly when it scales, I think it's pushed up and goes into the top bar". Measured from their screenshot: the in-app top bar sits where expected (level ring top ~65pt, just under the 59pt status bar / Dynamic Island inset), but the bottom tab bar ends at ~870pt instead of reaching the bottom of the 932pt screen, leaving an empty ~60pt strip of page background below it; the home logo also switched to the one-row compact layout, which only happens when the computed content height is under 730 frame px. In Chromium emulation at 430x932 with safe-area insets 59/34 the same build fills the screen correctly. So on the real device the app appears to measure a viewport about 59pt (= the status bar height) shorter than the screen.`

const RESEARCH = {
  type: 'object',
  properties: {
    cause: { type: 'string' },
    affected: { type: 'string', description: 'iOS versions / modes known to be affected' },
    whatMeasuresWrong: { type: 'string', description: 'which of innerHeight, documentElement.clientHeight, visualViewport.height, 100vh/100dvh/100lvh/100svh, position:fixed inset:0, screen.height report what in this situation' },
    fixes: { type: 'array', items: { type: 'object', properties: { fix: { type: 'string' }, tradeoffs: { type: 'string' } }, required: ['fix'] } },
    sources: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string' },
  },
  required: ['cause', 'whatMeasuresWrong', 'fixes', 'sources'],
}

const DIAG = {
  type: 'object',
  properties: {
    diagnosis: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    proposedFix: { type: 'string', description: 'concrete code-level change, with the exact measurement logic' },
    risks: { type: 'array', items: { type: 'string' } },
    otherLayoutRisks: { type: 'array', items: { type: 'string' }, description: 'other ways the fitting could go wrong on real iPhones (Safari tab, rotation, keyboard, iPad), if any' },
  },
  required: ['diagnosis', 'proposedFix'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          scenario: { type: 'string', description: 'concrete steps or input -> wrong result a player would see' },
          fix: { type: 'string' },
        },
        required: ['title', 'file', 'severity', 'scenario'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' }, betterFix: { type: 'string' } },
  required: ['real', 'reason'],
}

const NFL_CHANGE = `The latest commit caf5a8d ("Add NFL football", on branch perfect-gameplay; parent 2a9a05c) plus a few uncommitted edits (see "git diff") add NFL football next to the existing NBA game. Summary: src/engine/sport.ts picks one sport per page load (?sport= param, else localStorage 'perfect-season:sport', else nba; switching saves and reloads). Football lineup: QB, RB, WR, TE, FLEX (RB/WR/TE), DEF (team defense per decade) = 6 rounds; 17-game season with generated scores; four one-game playoff rounds (Wild Card .. Super Bowl, neutral final); data in src/data/nfl.json built by scripts/build_nfl_data.py from scripts/nfl_sources.py. Separate leaderboards/queue/match namespaces for NFL; shared name/coins/xp/boosters/settings/daily chest with sport-specific profile part in localStorage key 'perfect-season:profile:nfl:v1'. HARD REQUIREMENT: basketball behaviour must be unchanged (its DATA_V fingerprint '1gypzor' is unchanged so old/new NBA phones still match and leaderboard entries stay valid). Tests: "npm test" runs vitest twice (NBA, then PS_SPORT=nfl) — do not run the whole suite (it is slow and shares the machine with other tests); you may run a single small vitest file if you must.`

const DIMENSIONS = [
  { key: 'engine', prompt: `Review the ENGINE and RULES side: src/engine/*.ts (sport, types, data, rating, season, playoffs, draft, online, missions, economy, version, rarity) for correctness bugs in either sport: wrong round counts, off-by-one, NBA assumptions left in (5 rounds, 82 games, PG..C), football edge cases (FLEX eligibility, DEF uniqueness by pid "D-<franchise>", Prime on defenses, ties in playoff records, score generation that disagrees with results, perfect-season detection, bot/AI picks, head-to-head cell order/redraws with 6 rounds), and anything that would change NBA results.` },
  { key: 'ui', prompt: `Review the SCREENS: src/ui/*.tsx, src/ui/sportui.ts, src/main.tsx, src/styles.css. Look for: basketball-only wording or numbers shown in football (82, 16-0, "series", "court", "Finals", five rounds), football wording shown in basketball, broken layout with six cards / 17 schedule tiles / longer labels on small screens (375x548 Safari is the smallest supported), stat columns that show the wrong stat for a position, sorting that misbehaves, accessibility labels that are wrong, and visual states that never clear (e.g. the sport-switch overlay). Report real user-visible problems only.` },
  { key: 'online', prompt: `Review ONLINE PLAY and SAVED PROGRESS: src/net/match.ts, src/net/leaderboard.ts, src/net/nostr.ts, src/lib/profile.ts, src/App.tsx, src/ui/Search.tsx. Look for: NBA and NFL players able to pair (or unable to when they should), leaderboard entries that validate in the wrong sport, the room "lobby" mismatch notice misfiring, invite links (?room=CODE&sport=nfl) not landing in the right sport/room, profile split bugs (shared vs per-sport fields lost or overwritten when switching sports, the reset-progress path, rename propagation across sports, a first-time user who starts on NFL), activeMatch/forfeit handling per sport, and anything that changes NBA online behaviour.` },
  { key: 'data', prompt: `Review the FOOTBALL DATA: src/data/nfl.json (fields listed in its "fields"/"def_fields" keys; parser in src/engine/data.ts) and scripts/build_nfl_data.py + scripts/nfl_sources.py. Use small python3 one-liners to inspect the JSON. Look for: wrong historical team names/abbreviations for an era (e.g. Oilers/Titans, Colts, Raiders, Rams, Cardinals, Chargers, Washington), duplicated or missing famous players, players listed at the wrong position (e.g. a QB as WR), absurd per-game values, defenses with impossible numbers, playoff teams with wrong records or champions, namesake handling, and builder logic errors (era adjustment, shrinkage, quantile mapping, prime links). Report concrete records that are wrong, with the evidence.` },
]

const researchTrack = async () => {
  const angles = [
    'Search the web (WebSearch/WebFetch) for the iOS home-screen web app (standalone PWA, apple-mobile-web-app-capable + status-bar-style black-translucent + viewport-fit=cover) bug where window.innerHeight / the layout viewport / position:fixed elements are shorter than the screen by the status bar height, leaving a gap at the bottom. Prefer WebKit bug tracker entries, Apple developer forums, and StackOverflow answers with measurements.',
    'Search the web for how production PWAs reliably get the full-screen height in iOS standalone mode on iPhones with a Dynamic Island (iOS 17 and 18): what 100vh, 100dvh, 100lvh, 100svh, -webkit-fill-available, screen.height, visualViewport and documentElement.clientHeight report there, and whether the values change after the first load, after returning from background, or after rotation. Collect concrete recommended code.',
  ]
  return parallel(angles.map((a, i) => () => agent(`${CONTEXT}\n\n${DEVICE}\n\nYour job (research only, no repo edits): ${a}\nReturn what is known, which measurement is wrong and which is trustworthy, and recommended fixes with trade-offs. Cite URLs you actually read.`, { label: 'research-' + (i + 1), phase: 'Research', schema: RESEARCH })))
}

const diagnoseTrack = async () =>
  agent(`${CONTEXT}\n\n${DEVICE}\n\nYour job: read src/stage.tsx (measure(), readInsets(), the Stage component) and the CSS for html, body, #root, .viewport, .stage and .inset-probe in src/styles.css, plus index.html. Explain precisely how the app ends up with a frame about 59pt short on the real device while emulation is correct (which value it trusts: root.clientHeight, innerHeight, the probe insets, ...), and propose a concrete, minimal, robust fix in that code that (a) fills the screen in iOS standalone mode, (b) does not break Safari tabs (where the bottom toolbar legitimately shortens the viewport), Android, iPad/desktop framed mode, or the sideways-phone counter-rotation, and (c) keeps the frame and its .viewport container the same size so nothing is clipped. Also list any other ways this fitting could go wrong on real iPhones.`, { label: 'diagnose-stage', phase: 'Diagnose', schema: DIAG })

const reviewTrack = async () =>
  pipeline(
    DIMENSIONS,
    (d) => agent(`${CONTEXT}\n\n${NFL_CHANGE}\n\nYour review dimension: ${d.prompt}\nUse "git -C ${REPO} show caf5a8d", "git -C ${REPO} diff" and read the files. Report only problems you can tie to a concrete scenario; no style nits. Up to 10 findings, most severe first.`, { label: 'review-' + d.key, phase: 'Review', schema: FINDINGS }),
    (r, d) =>
      parallel(
        (r?.findings ?? []).slice(0, 8).map((f, j) => () =>
          agent(
            `${CONTEXT}\n\n${NFL_CHANGE}\n\nA reviewer reported this possible bug. Try hard to REFUTE it by reading the actual code/data (and running a tiny check if useful). Default to real=false if you cannot confirm a concrete failing path.\nTitle: ${f.title}\nFile: ${f.file}${f.line ? ':' + f.line : ''}\nSeverity claimed: ${f.severity}\nScenario: ${f.scenario}\nSuggested fix: ${f.fix ?? '(none)'}`,
            { label: 'verify-' + d.key + '-' + (j + 1), phase: 'Verify', schema: VERDICT }
          ).then((v) => ({ ...f, dimension: d.key, verdict: v }))
        )
      ).then((xs) => {
        const dropped = Math.max(0, (r?.findings ?? []).length - 8)
        if (dropped) log(d.key + ': ' + dropped + ' lower-ranked findings not verified')
        return xs.filter(Boolean)
      })
  )

const [research, diagnosis, reviews] = await parallel([researchTrack, diagnoseTrack, reviewTrack])
const all = (reviews ?? []).filter(Boolean).flat()
return {
  research: (research ?? []).filter(Boolean),
  diagnosis,
  confirmed: all.filter((f) => f.verdict && f.verdict.real),
  refuted: all.filter((f) => !f.verdict || !f.verdict.real).map((f) => ({ title: f.title, dimension: f.dimension, reason: f.verdict ? f.verdict.reason : 'no verdict' })),
}
