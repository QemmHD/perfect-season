export const meta = {
  name: 'studio-build-team',
  description: 'One studio-overhaul build team: plan + completeness critique, build each task with an independent review and fixes, then final QA',
  phases: [
    { title: 'Plan', detail: 'planner reads audits/research/code, critic checks completeness, planner revises' },
    { title: 'Build', detail: 'implement each task; independent reviewer checks it in a separate checkout; fixer applies findings' },
    { title: 'Final QA', detail: 'full tests, build, browser walk, team doc' },
  ],
}

const T = args.team
const O = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul'
const WT = '/home/user/ps-s-' + T
const BR = 'claude/studio-' + T
const PORTS = { shell: 5211, ut: 5212, packs: 5213, players: 5214, nba: 5215, nfl: 5216, soccer: 5217 }
const PORT = PORTS[T]
const RPORT = PORT + 100
const PLANFILE = WT + '/docs/studio-overhaul/' + T + '-plan.md'
const TEAMDOC = WT + '/docs/studio-overhaul/' + T + '.md'

const COMMON = [
  'You are part of a 7-team studio overhaul of Perfect Season (a React/TypeScript/Vite iPhone home-screen PWA with NBA, NFL and Soccer: draft modes, arcade match engines with a pixel-art renderer, and Ultimate Team). Your team: "' + T + '".',
  'Team git worktree: ' + WT + ' (branch ' + BR + '). Work ONLY there: start every shell command with `cd ' + WT + ' &&` because the shell can reset its directory. Team dev-server port: ' + PORT + '.',
  'Read these BEFORE anything else, in full: ' + O + '/BRIEF.md (the owner\'s request verbatim + hard constraints), ' + O + '/BUILD-RULES.md (shared-machine rules: the heavy.sh semaphore for tsc/vitest/build/Playwright, test commands, dev-server start/stop by PID, QA isolation from live services, git/commit format, team doc), ' + O + '/OWNERSHIP.md (which files your team may edit), ' + O + '/STREAM-' + T + '.md (your team\'s scope, priorities and source files), and the repo\'s CLAUDE.md.',
  'Team plan: ' + PLANFILE + '. Team doc: ' + TEAMDOC + '.',
  'Hard rules you must never break: never reset or change saves/storage keys/card or copy ids (new state is additive with defaults); coins only; never touch live Supabase/Nostr/leaderboards (QA isolated: ?ns=inspect&relay=ws://localhost:7777 plus route-abort of non-localhost hosts); never edit DRAFT_RULES/UT_RULES (report "Protocol bump needed" instead); seeded RNG only inside simulation code; pick({nba,nfl,soccer}) not two-way sport ternaries; 390 design frame, taps >= 44 px, reduced motion respected; no model names, secrets or emails in code/commits; never use pkill -f / pgrep -f; never git add -A; never push main, force-push, rebase or bare git stash.',
].join('\n')

const TASK_ITEM = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    priority: { type: 'string' },
    spec: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    acceptance: { type: 'array', items: { type: 'string' } },
    protocol: { type: 'string' },
  },
  required: ['id', 'title', 'spec', 'acceptance'],
}
const PLAN_SCHEMA = {
  type: 'object',
  properties: { tasks: { type: 'array', items: TASK_ITEM }, deferred: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } },
  required: ['tasks'],
}
const CRIT_SCHEMA = {
  type: 'object',
  properties: {
    missing: { type: 'array', items: { type: 'string' } },
    restructure: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    targets: { type: 'array', items: { type: 'string' } },
  },
  required: ['missing', 'restructure', 'risks', 'targets'],
}
const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    baseSha: { type: 'string' },
    headSha: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    verification: { type: 'string' },
    protocolBump: { type: 'string' },
    followups: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, spec: { type: 'string' }, must: { type: 'boolean' } }, required: ['title', 'spec', 'must'] } },
  },
  required: ['status', 'baseSha', 'headSha', 'summary', 'verification', 'followups'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fix'] },
    issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'where', 'problem', 'fix'] } },
    checked: { type: 'string' },
  },
  required: ['verdict', 'issues', 'checked'],
}
const QA_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['green', 'issues'] },
    tests: { type: 'string' },
    build: { type: 'string' },
    browser: { type: 'string' },
    protocolBumps: { type: 'array', items: { type: 'string' } },
    touchedOutsideLane: { type: 'array', items: { type: 'string' } },
    ownerChecks: { type: 'array', items: { type: 'string' } },
    leftUndone: { type: 'array', items: { type: 'string' } },
    headSha: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['status', 'tests', 'build', 'browser', 'protocolBumps', 'leftUndone', 'headSha', 'summary'],
}

const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '')

// ---------------- Plan ----------------
phase('Plan')
let plan = await agent(COMMON + '\n\nROLE: PLANNER. Do not change code in this step.\n' +
  '1. Read every source your STREAM brief lists, in full (the audit and research files are long: read them completely, not skimmed), plus the code they point to, enough to plan concrete changes with file and function names.\n' +
  '2. Write the build plan to ' + PLANFILE + ' (create docs/studio-overhaul/). Contents: goals; EVERY scope item in the brief mapped to a task (nothing silently dropped; anything deliberately deferred listed with the reason); per task: the exact changes (files, functions, data shapes), the tests and measurements that prove it with target numbers from the audits/research, the screenshots to take, protocol impact, save-compat risks, and dependencies on other teams.\n' +
  '3. Split the work into 6-10 ordered tasks: P0 first, enabling work first. Each task is a coherent unit that one engineer can implement, test and commit in one focused session (about 1-3 hours), on a coherent set of files. No catch-all "everything else" task.\n' +
  '4. Commit only the plan file (explicit path) with a "Claude: " message and the trailer from BUILD-RULES, then push the branch.\n' +
  'Return the ordered task list (each task: id like "' + T + '-1", title, priority P0/P1/P2, a detailed spec, files, measurable acceptance criteria, protocol impact), the deferred items, and notes.',
  { label: T + ' plan', phase: 'Plan', schema: PLAN_SCHEMA })

const crit = await agent(COMMON + '\n\nROLE: COMPLETENESS AND RISK CRITIC (read-only; edit nothing). Read the plan at ' + PLANFILE + ', then your team\'s STREAM brief and every audit/research source it names, and skim the code involved. Report concretely:\n' +
  '(a) missing: every item relevant to this team in the brief, audits or research that the plan misses or under-specifies (cite the audit ID or research section) - the owner said "find all aspects dont miss them";\n' +
  '(b) restructure: tasks too large or vague for one session, wrongly ordered, or with hidden dependencies;\n' +
  '(c) risks: saves/storage keys, determinism and online protocol, file-ownership collisions with other teams (OWNERSHIP.md), performance and bundle size, iPhone layout (390 frame, 44 px taps, safe areas, small phones), reduced motion, original branding;\n' +
  '(d) targets: acceptance criteria that lack measurable targets, with the numbers they should use.',
  { label: T + ' critic', phase: 'Plan', schema: CRIT_SCHEMA })

plan = await agent(COMMON + '\n\nROLE: PLANNER (revision). An independent critic reviewed your team plan at ' + PLANFILE + '. Critique (JSON):\n' + JSON.stringify(crit) +
  '\nUpdate the plan to address every point, or note in the plan why a point is rejected. Keep 6-10 ordered tasks, each one session-sized with measurable acceptance. Commit and push the plan file. Return the final ordered task list, deferred items and notes.',
  { label: T + ' plan revise', phase: 'Plan', schema: PLAN_SCHEMA })

log(T + ': plan has ' + plan.tasks.length + ' tasks: ' + plan.tasks.map(t => t.id).join(', '))

// ---------------- Build ----------------
const done = []
const results = []

function implPrompt(t, extra) {
  return COMMON + '\n\nROLE: IMPLEMENTER for task ' + t.id + ' - "' + t.title + '" (priority ' + (t.priority || '') + ').\n' +
    'Spec: ' + t.spec + '\nFiles: ' + JSON.stringify(t.files || []) + '\nAcceptance: ' + JSON.stringify(t.acceptance) + '\nProtocol impact: ' + (t.protocol || 'see plan') + '\n' +
    (extra ? extra + '\n' : '') +
    'Tasks already finished in this worktree by teammates (summaries): ' + (done.length ? done.join('\n') : 'none yet') + '\n' +
    'RESTART NOTE: the machine restarted once while an earlier agent was working (2026-11-10). The worktree may hold that agent\'s uncommitted changes, and possibly some of its commits after the plan commits. Begin with `git status`, `git diff` and `git log --oneline acdf3e2..HEAD`. Keep and finish good in-progress work for THIS task. Don\'t redo committed work. If you find leftover work that belongs to a later task, leave it. Make baseSha the HEAD from before this task\'s first attempt began; for the first task, that is the latest plan commit ("... plan ..."). Delete stray debug files such as dbg-*.png and never commit them.\n' +
    'Steps:\n' +
    '1. cd ' + WT + '; record baseSha (see the restart note); read the plan section for this task and the code you will change.\n' +
    '2. Measure "before" for any numeric acceptance (reuse or copy the audit harnesses in ' + O + '/audit-scripts/).\n' +
    '3. Implement fully, at production-studio quality: no TODO stubs, no placeholder art, no dead code. Stay inside OWNERSHIP.md; new CSS goes in new files your team owns.\n' +
    '4. Add/extend vitest tests that prove the acceptance; keep existing tests passing (change an old test only when its old behaviour was the bug, and say so).\n' +
    '5. Verify: `bash ' + O + '/heavy.sh npm run typecheck`; your area\'s vitest paths via heavy.sh; for anything visible, start the dev server on port ' + PORT + ' (BUILD-RULES), check it in Playwright with touch at 393x852 (insets 59/34) and 320x568, isolated from live services, save screenshots under ' + O + '/shots/' + T + '/' + t.id + '/ and LOOK at them; stop the dev server by PID.\n' +
    '6. Re-read your whole diff adversarially (old saves, online determinism, the other two sports, small phones, reduced motion, performance) and fix what you find.\n' +
    '7. Update ' + TEAMDOC + ' (what changed, before/after numbers, tests, "Protocol bump needed" lines, "Touched outside my lane", "Owner device checks").\n' +
    '8. Commit with explicit paths and push (BUILD-RULES format). Record `git rev-parse HEAD` as headSha.\n' +
    'If the task is bigger than one session, deliver a coherent, tested, committed subset and list the rest as followups (must=true when the owner\'s request is not met without it).\n' +
    'Return: status, baseSha, headSha, commits (short sha + subject), summary, verification (exact commands and results, numbers), protocolBump (or "none"), followups.'
}

function reviewPrompt(t, impl, id) {
  const RW = '/home/user/ps-r-' + T + '-' + id
  return COMMON + '\n\nROLE: INDEPENDENT REVIEWER for task ' + t.id + ' - "' + t.title + '". You did not write it. Do NOT edit or commit anything in ' + WT + '; the implementer may already be working on the next task there.\n' +
    'Review in your own detached checkout: `git -C /home/user/perfect-season worktree add --detach ' + RW + ' ' + impl.headSha + ' && ln -sfn /home/user/ps-codex/node_modules ' + RW + '/node_modules`; run everything there (dev server on port ' + RPORT + ' if needed); when finished stop your dev server by PID and run `git -C /home/user/perfect-season worktree remove --force ' + RW + '`.\n' +
    'Changes under review: `git -C ' + RW + ' diff ' + impl.baseSha + '..' + impl.headSha + '` (commits: ' + JSON.stringify(impl.commits || []) + ').\n' +
    'Acceptance: ' + JSON.stringify(t.acceptance) + '\nImplementer\'s summary: ' + clip(impl.summary, 3000) + '\nImplementer\'s verification: ' + clip(impl.verification, 3000) + '\n' +
    'Try hard to find what is wrong rather than confirming it works: bugs and edge cases; regressions in the other sports; old saves failing to load or losing anything; storage key/id changes; non-determinism inside simulation code; acceptance numbers that do not hold when YOU re-measure; layout at 393x852 (59/34) and 320x568 (screenshot it yourself, isolated, and look); taps under 44 px or text under 10 px; reduced motion ignored; performance or bundle regressions; files outside the team\'s ownership; missing tests; TODOs or placeholders; brand-name problems; anything a player would see as unpolished. Run the relevant tests yourself via heavy.sh.\n' +
    'verdict "pass" only if nothing at medium severity or above remains. For each issue: severity, where (file:line), problem, concrete fix.'
}

async function fixRound(t, impl, rev, id) {
  const serious = rev.issues.filter(i => i.severity !== 'low')
  if (rev.verdict === 'pass' && !serious.length) return { fixed: null, rereview: null }
  const fixed = await agent(COMMON + '\n\nROLE: FIXER for task ' + t.id + ' - "' + t.title + '". An independent review of commits ' + impl.baseSha + '..' + impl.headSha + ' found these issues (JSON):\n' + JSON.stringify(rev.issues) +
    '\nThe worktree may now also contain later tasks\' commits; fix on the current HEAD. Fix every critical, high and medium issue properly, and low ones that are real bugs. If you believe an issue is wrong, verify carefully and explain why in your summary instead of changing code. Re-run the relevant checks via heavy.sh (and the browser for visible fixes), update the team doc, commit with explicit paths and push. Return the implementer fields (status, baseSha, headSha, commits, summary, verification, protocolBump, followups).',
    { label: T + ' ' + id + ' fix', phase: 'Build', schema: IMPL_SCHEMA })
  let rereview = null
  if (fixed && rev.issues.some(i => i.severity === 'critical' || i.severity === 'high')) {
    rereview = await agent(reviewPrompt(t, { baseSha: impl.baseSha, headSha: fixed.headSha, commits: (impl.commits || []).concat(fixed.commits || []), summary: impl.summary + '\nFIXES: ' + fixed.summary, verification: fixed.verification }, id + 'b') +
      '\nThis is a RE-REVIEW after fixes. The earlier issues were: ' + JSON.stringify(rev.issues) + '. Check each is really fixed and that the fixes broke nothing. Later tasks\' commits may be included in the range; focus on this task\'s area.',
      { label: T + ' ' + id + ' re-review', phase: 'Build', schema: REVIEW_SCHEMA })
    if (rereview && rereview.issues.some(i => i.severity === 'critical' || i.severity === 'high')) {
      const fixed2 = await agent(COMMON + '\n\nROLE: FIXER (second round) for task ' + t.id + '. Re-review still found (JSON): ' + JSON.stringify(rereview.issues) + '\nFix them on the current HEAD, verify, update the team doc, commit and push. Return the implementer fields.',
        { label: T + ' ' + id + ' fix2', phase: 'Build', schema: IMPL_SCHEMA })
      return { fixed, rereview, fixed2 }
    }
  }
  return { fixed, rereview }
}

let pending = null
const followups = []
for (let i = 0; i < plan.tasks.length; i++) {
  const t = plan.tasks[i]
  const id = 't' + (i + 1)
  const impl = await agent(implPrompt(t), { label: T + ' ' + id + ' build', phase: 'Build', schema: IMPL_SCHEMA })
  if (pending) {
    const p = await pending
    const f = await fixRound(p.t, p.impl, p.rev, p.id)
    results.push({ id: p.t.id, title: p.t.title, status: p.impl.status, summary: clip(p.impl.summary, 1500), protocolBump: p.impl.protocolBump, review: p.rev ? p.rev.verdict : 'none', issues: p.rev ? p.rev.issues.length : 0, fix: f.fixed ? clip(f.fixed.summary, 800) : null })
    pending = null
  }
  if (!impl) { results.push({ id: t.id, title: t.title, status: 'agent-failed' }); continue }
  done.push(t.id + ' (' + impl.status + '): ' + clip(impl.summary, 600))
  for (const f of impl.followups || []) if (f.must) followups.push({ ...f, from: t.id })
  pending = agent(reviewPrompt(t, impl, id), { label: T + ' ' + id + ' review', phase: 'Build', schema: REVIEW_SCHEMA }).then(rev => ({ t, impl, rev: rev || { verdict: 'pass', issues: [], checked: 'review agent failed' }, id }))
}
if (pending) {
  const p = await pending
  const f = await fixRound(p.t, p.impl, p.rev, p.id)
  results.push({ id: p.t.id, title: p.t.title, status: p.impl.status, summary: clip(p.impl.summary, 1500), protocolBump: p.impl.protocolBump, review: p.rev.verdict, issues: p.rev.issues.length, fix: f.fixed ? clip(f.fixed.summary, 800) : null })
}

// Must-have follow-ups (bounded; anything beyond the bound is reported)
const MAXF = 3
if (followups.length > MAXF) log(T + ': ' + (followups.length - MAXF) + ' must-have follow-ups beyond the first ' + MAXF + ' are left for the lead: ' + followups.slice(MAXF).map(f => f.title).join(' | '))
for (let k = 0; k < Math.min(MAXF, followups.length); k++) {
  const f = followups[k]
  const t = { id: T + '-f' + (k + 1), title: f.title, spec: f.spec + ' (follow-up from ' + f.from + ')', acceptance: ['The follow-up described in the spec is complete, tested and committed.'], priority: 'P0' }
  const id = 'f' + (k + 1)
  const impl = await agent(implPrompt(t), { label: T + ' ' + id + ' build', phase: 'Build', schema: IMPL_SCHEMA })
  if (!impl) continue
  done.push(t.id + ' (' + impl.status + '): ' + clip(impl.summary, 600))
  const rev = await agent(reviewPrompt(t, impl, id), { label: T + ' ' + id + ' review', phase: 'Build', schema: REVIEW_SCHEMA })
  const fr = rev ? await fixRound(t, impl, rev, id) : { fixed: null }
  results.push({ id: t.id, title: t.title, status: impl.status, summary: clip(impl.summary, 1500), protocolBump: impl.protocolBump, review: rev ? rev.verdict : 'none', issues: rev ? rev.issues.length : 0, fix: fr.fixed ? clip(fr.fixed.summary, 800) : null })
}

// ---------------- Final QA ----------------
phase('Final QA')
const qa = await agent(COMMON + '\n\nROLE: FINAL QA for team ' + T + '. All planned tasks are done. Their summaries:\n' + done.join('\n') + '\n' +
  '1. Run the full suite once: `cd ' + WT + ' && bash ' + O + '/heavy.sh npm test` (all three sports; slow). Fix failures caused by this team\'s changes. If a failure also happens on the untouched base acdf3e2, say so (check it in a temporary detached worktree at acdf3e2 with the node_modules symlink, then remove it).\n' +
  '2. Run `bash ' + O + '/heavy.sh npm run build` once and fix any errors.\n' +
  '3. Browser walk, isolated from live services: every screen and flow this team changed, in all three sports where relevant, at 393x852 (insets 59/34) and 320x568, plus a full smoke of the core flow (a whole match, or a full pack opening, or app start to UT Home, as relevant). Screenshots go to ' + O + '/shots/' + T + '/final/. Look at them, and fix anything broken or unpolished.\n' +
  '4. Make ' + TEAMDOC + ' complete and accurate: what changed, numbers, tests, protocol bumps needed, touched outside lane, owner device checks, left undone.\n' +
  '5. Commit with explicit paths and push. Return the structured result with the final headSha.',
  { label: T + ' final QA', phase: 'Final QA', schema: QA_SCHEMA })

return { team: T, tasks: plan.tasks.map(t => t.id + ': ' + t.title), deferred: plan.deferred || [], results, qa }
