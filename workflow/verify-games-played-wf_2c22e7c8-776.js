export const meta = {
  name: 'verify-games-played',
  description: 'Independently check the football games-played and PFR-matching fixes in commit 1c82ef3 against the raw sources',
  phases: [{ title: 'Verify' }],
}
const REPO = '/home/user/perfect-season'
const BASE = `Repo ${REPO} builds football data (src/data/nfl.json) with scripts/build_nfl_data.py from loaders in scripts/nfl_sources.py. Raw sources are cached in ${REPO}/.cache/nfl: fdp/<year>.csv = Pro-Football-Reference season tables 1970-2021 (columns Player, Tm, Pos, Age, G, GS, PassingYds, ...; traded players appear only as one 2TM/3TM row), wk/<year>.csv = nflverse weekly stats 1999-2025 (a row only for games with a stat), rs/<year>.csv = nflverse season rosters, rw/<year>.csv = nflverse weekly rosters 2002-2025 (status, status_description_abbr), games.csv = nflverse schedules, players.csv = register. The latest commit 1c82ef3 (see \`git -C ${REPO} show 1c82ef3 --stat\` and its message, and the previous commit bf23350) changed how games played are computed for 1999-2025. Do NOT edit or commit anything in the repo; import the loaders from a script under /tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/review3/ (create it), e.g. sys.path.insert(0, '${REPO}/scripts'); import nfl_sources as S. Try hard to find real defects: concrete player-seasons where the result is wrong compared with the raw sources, with numbers. Ignore anything negligible (a single game for a fringe player). If everything checks out, return ok=true with what you checked.`
const OUT = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    checked: { type: 'string' },
    defects: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['title', 'severity', 'evidence', 'fix'] } },
  },
  required: ['ok', 'checked', 'defects'],
}
phase('Verify')
const [a, b] = await parallel([
  () => agent(`${BASE}\n\nYour check: GAMES PLAYED. Call S.verse_rows(raw_dir, S.Register(...)) and compare every 1999-2021 player-season against PFR: (1) one-team seasons should equal PFR's G exactly (count and list mismatches, and why); (2) traded seasons (PFR 2TM/3TM row) — do the stints' games sum to PFR's combined G and does each stint stay within the games that team played while he was there; (3) 2022-2025 non-QB counts (weekly rosters, weeks the team played, no inactives) — any line above the team's game count, or obviously wrong (compare with stat-row counts and snap logic); (4) 2016-2019 seasons with no PFR row fall back to stat rows — how many listed players are affected. Also check the final src/data/nfl.json: no line's games exceed its seasons' games, and famous Texans/Raiders lines (Andre Johnson, Arian Foster, DeAndre Hopkins, J.J. Watt is defense so skip, Josh Jacobs, Davante Adams, Darren Waller) match PFR.`, { label: 'verify-games', phase: 'Verify', schema: OUT }),
  () => agent(`${BASE}\n\nYour check: PLAYER MATCHING. nfl_sources.match_pfr matches PFR rows to nflverse ids by register (name + birth year) and, for names the register can't place, by same team + season + last name + yards within max(5, 3%). Look for FALSE matches (a PFR row attached to the wrong nflverse player, e.g. two players with the same last name on one team-season with similar yards, or a register match to a namesake) and MISSED matches (a starter whose one-team season still didn't get PFR's row). Also check pfr_franchise now maps every 1999-2021 PFR team code correctly by season (HOU Oilers before 1999 vs Texans from 2002, LVR, OAK, SDG/LAC, STL/LAR, BAL), and settle_ids' chained stand-in ids never merge two real different people (list any pfr: ids or merged ids holding clearly different careers).`, { label: 'verify-matching', phase: 'Verify', schema: OUT }),
])
return { games: a, matching: b }
