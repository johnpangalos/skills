import type { EngineInterface, Register } from 'claude-code'
import { checkOf, noteFor, parseNotes, planRewrite, projectChecks, segments, tokenize } from './check-cache'
import { PANEL_FOCI, isProbe, mustFixes, panelPrompts, requestOf, timeline, withRequest, withRuledOn } from './extras'
import type { Span } from './extras'

// feature-flow-lite's mod. Silent until the skill is invoked (a skill.prompt
// for feature-flow-lite); after that it keeps the ACCEPTANCE CRITERIA block in
// implementor and reviewer handoffs, flags implementor runs that changed no
// test file, and records per-role tokens and time for /ff-usage. With
// FEATURE_FLOW_CHECK_CACHE=1 it also caches passing checks (check-cache.ts):
// every agent's check commands go through a wrapper that replays a pass on an
// unchanged tree instead of running it again. With FEATURE_FLOW_EXTRAS=1 it
// also: starts the full checks ahead of the orchestrator (when an implementor or
// simplifier finishes and when a gatekeeper starts) and on a copy of the base
// commit; puts the user's request word for word into criteria-checker and
// gatekeeper handoffs; carries earlier must-fixes to later gatekeepers as RULED
// ON; turns a `FOCUS: panel` gatekeeper call into three focused gatekeepers run
// in parallel; denies the main conversation's edits to repo files (the one hook
// that can deny); and removes leftover zz_gate_ probe files. Every other hook
// passes the event through unless its condition holds.

type Role = 'investigator' | 'implementor' | 'simplifier' | 'reviewer' | 'gatekeeper' | 'criteria-checker'

const ROLES: readonly Role[] = ['investigator', 'implementor', 'simplifier', 'reviewer', 'gatekeeper', 'criteria-checker']
// the roles whose handoffs must carry the ACCEPTANCE CRITERIA block
const CRITERIA_ROLES: readonly Role[] = ['implementor', 'reviewer']
const ROLE_ORDER = ['orchestrator', ...ROLES, 'other']
const AGENT_PREFIX = 'feature-flow-lite:'

type UsageRecord = {
  role: string
  agentId?: string
  model: string | null
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  durationMs: number
  reason: string
  startedAt?: number
  endedAt?: number
}

const isRole = (name: string): name is Role => (ROLES as readonly string[]).includes(name)

const isOurSkill = (skill: string) => /^(?:[^:]+:)?feature-flow-lite$/.test(skill)

// Our roles: a named feature-flow-lite agent, or general-purpose whose prompt
// opens with a ROLE line (the SKILL.md fallback).
function roleOf(subagentType: string | undefined, prompt: string | undefined): Role | undefined {
  if (subagentType?.startsWith(AGENT_PREFIX)) {
    const name = subagentType.slice(AGENT_PREFIX.length)
    return isRole(name) ? name : undefined
  }
  if (subagentType === 'general-purpose') {
    const first = (prompt ?? '').split('\n').find(line => line.trim() !== '')
    const match = first?.trim().match(/^ROLE:\s*([a-z-]+)$/)
    const name = match?.[1]
    return name !== undefined && isRole(name) ? name : undefined
  }
  return undefined
}

// The handoff headers that can follow the criteria. A criterion that merely
// starts in capitals ("UI: ...") is not one.
const HANDOFF_HEADER = /^(?:GOAL|FILES|CONSTRAINTS|HOSTILE INPUTS|CHECKS|PROJECT CHECKLIST|REQUEST|SIBLING|BASE|RULED ON|FOCUS|STATUS|SUMMARY|FILES TOUCHED|FINDINGS|OPEN QUESTIONS):/

// The ACCEPTANCE CRITERIA block: from its header line through the line before
// the next handoff header (CHECKS:, HOSTILE INPUTS:, ...), or the end.
function criteriaBlock(prompt: string): string | undefined {
  const lines = prompt.split('\n')
  const start = lines.findIndex(line => /^\s*ACCEPTANCE CRITERIA:/.test(line))
  if (start < 0) return undefined
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (HANDOFF_HEADER.test(lines[i] ?? '')) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n').trimEnd()
}

// One porcelain line is "XY path", or "XY old -> new" for a rename.
function porcelainPath(line: string): string {
  const rest = line.slice(3)
  const raw = rest.includes(' -> ') ? rest.slice(rest.lastIndexOf(' -> ') + 4) : rest
  return raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
    ? raw.slice(1, -1).replace(/\\(.)/g, '$1')
    : raw
}

const TEST_DIRS = new Set(['test', 'tests', '__tests__', 'spec'])
const TEST_BASENAME = /^test_|_test\.[^/]+$|\.test\.[^/]+$|\.spec\.[^/]+$/

function isTestFile(path: string): boolean {
  const parts = path.split('/')
  const base = parts.pop() ?? ''
  return parts.some(part => TEST_DIRS.has(part)) || TEST_BASENAME.test(base)
}

// Changed paths in the session's repo, or undefined when git cannot say.
async function changedPaths($: EngineInterface): Promise<string[] | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', 'status', '--porcelain', '--untracked-files=all'])
    if (exitCode !== 0) return undefined
    return stdout
      .split('\n')
      .filter(line => line.length > 3)
      .map(porcelainPath)
  } catch {
    return undefined
  }
}

const ROLE_ROW = (cells: readonly string[]) =>
  [(cells[0] ?? '').padEnd(14), ...cells.slice(1).map(cell => cell.padStart(12))].join(' ').trimEnd()

function usageTable(records: readonly UsageRecord[]): string {
  if (records.length === 0) return 'ff-usage: nothing recorded yet. Records start once feature-flow-lite is invoked.'

  const sum = (rows: readonly UsageRecord[]) => ({
    runs: rows.length,
    input: rows.reduce((n, r) => n + r.input_tokens, 0),
    output: rows.reduce((n, r) => n + r.output_tokens, 0),
    cacheRead: rows.reduce((n, r) => n + r.cache_read_input_tokens, 0),
    cacheWrite: rows.reduce((n, r) => n + r.cache_creation_input_tokens, 0),
    ms: rows.reduce((n, r) => n + r.durationMs, 0),
  })
  const cells = (name: string, t: ReturnType<typeof sum>) => [
    name,
    String(t.runs),
    String(t.input),
    String(t.output),
    String(t.cacheRead),
    String(t.cacheWrite),
    (t.ms / 1000).toFixed(1),
  ]

  const roles = ROLE_ORDER.filter(role => records.some(r => r.role === role))
  const header = ROLE_ROW(['role', 'runs', 'input', 'output', 'cache read', 'cache write', 'seconds'])
  const rows = roles.map(role => ROLE_ROW(cells(role, sum(records.filter(r => r.role === role)))))
  const total = ROLE_ROW(cells('total', sum(records)))
  const spans: Span[] = records
    .filter(r => r.agentId !== undefined && r.startedAt !== undefined && r.endedAt !== undefined)
    .map(r => ({ role: r.role, startedAt: r.startedAt ?? 0, endedAt: r.endedAt ?? 0 }))
  const when = timeline(spans)
  return ['ff-usage (feature-flow-lite, this session)', header, ...rows, total, ...(when ? ['', when] : [])].join('\n')
}

export const register: Register = on => {
  let gated = false
  let savedCriteria: string | undefined
  const roleByAgent = new Map<string, Role>()
  const records: UsageRecord[] = []

  const st: ExtrasState = {
    cache: undefined,
    extras: false,
    root: undefined,
    lastUserText: '',
    request: '',
    raised: [],
    baseStarted: false,
    runningGates: new Set<string>(),
    inflight: new Set<string>(),
    waiters: new Map<string, (report: string) => void>(),
  }

  on('prompt.submit', ($, e, next) => {
    st.lastUserText = e.text
    return next(e)
  }).catch(($, e, next) => next(e))

  on('skill.prompt', async ($, e, next) => {
    // Each invocation is a new feature: forget the last one's criteria.
    if (isOurSkill(e.skill)) {
      gated = true
      savedCriteria = undefined
      st.cache = await setUpCache($)
      st.extras = (await $.env.get('FEATURE_FLOW_EXTRAS').catch(() => undefined)) === '1'
      st.request = requestOf(st.lastUserText)
      st.raised = []
      st.baseStarted = false
      st.root = st.extras ? await repoRoot($) : undefined
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => (await guardEdit($, st, gated, e.agentId, e.file_path)) ?? next(e)).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'Write' }, async ($, e, next) => (await guardEdit($, st, gated, e.agentId, e.file_path)) ?? next(e)).catch(($, e, next) => next(e))

  // A gatekeeper call with `FOCUS: panel` runs three gatekeepers in parallel,
  // one per focus: the call itself becomes the first, and the mod starts the
  // other two and waits for their reports, which come back as context with
  // their agent ids (for SendMessage).
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (!gated || !st.extras || !(e.subagent_type ?? '').endsWith('gatekeeper')) return next(e)
    const prompts = panelPrompts(e.prompt)
    if (prompts === undefined) return next(e)
    const names = Object.keys(PANEL_FOCI)
    const others = await Promise.all(
      [1, 2].map(async i => {
        const base = prompts[i] ?? e.prompt
        const withReq = withRequest(base, st.request) ?? base
        const res = await $.agent.spawn({
          prompt: withRuledOn(withReq, st.raised) ?? withReq,
          description: `${e.description} (${names[i]})`,
          subagentType: e.subagent_type ?? 'general-purpose',
        } as never)
        const id = (res as { agentId?: string }).agentId
        if (id !== undefined) roleByAgent.set(id, 'gatekeeper')
        if (id === undefined) return { name: names[i], id: 'none', report: Promise.resolve('(the mod could not start this gatekeeper)') }
        return { name: names[i], id, report: new Promise<string>(resolve => st.waiters.set(id, resolve)) }
      }),
    )
    const first = await next({ ...e, prompt: prompts[0] ?? e.prompt, description: `${e.description} (${names[0]})`, run_in_background: false })
    if (first.deny !== undefined) return first
    const reports = await Promise.all(others.map(async o => `FOCUS ${o.name} (agent id ${o.id}):\n${await o.report}`))
    const firstId = (first.result as { agentId?: string } | undefined)?.agentId ?? 'unknown'
    const note =
      `${$.plugin.name} review panel: this call ran three gatekeepers in parallel. The result above is FOCUS ${names[0]} ` +
      `(agent id ${firstId}); the other two follow. Merge their must-fixes, and continue each with SendMessage to verify its fixes.`
    return { ...first, context: [...(first.context ?? []), note, ...reports] }
  }).catch(($, e, next) => next(e))

  // The check cache: route each check in a Bash call through the wrapper, then
  // say what was replayed. Off unless FEATURE_FLOW_CHECK_CACHE=1.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const cache = st.cache
    if (!gated || cache === undefined) return next(e)
    void ensureBaseChecks($, st)
    const checks = await readProjectChecks($, cache.root)
    const notes = `${cache.dir}/notes/${crypto.randomUUID()}`
    const plan = planRewrite(e.command, { script: cache.script, cacheDir: cache.dir, notes, projectChecks: checks })
    if (plan === undefined) return next(e)
    const ran = await next({ ...e, command: plan.command })
    if (e.run_in_background === true || ran.deny !== undefined) return ran
    let note: string | undefined
    try {
      if (await $.fs.exists(notes)) {
        note = noteFor(parseNotes(await $.fs.read(notes)), $.plugin.name)
        await $.process.run(['rm', '-f', notes])
      }
    } catch {
      return ran
    }
    return note === undefined ? ran : { ...ran, context: [...(ran.context ?? []), note] }
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    if (!gated) return next(e)

    const role = roleOf(e.subagentType, e.prompt)
    let prompt = e.prompt

    if (st.extras && (role === 'gatekeeper' || role === 'criteria-checker')) {
      const exact = withRequest(prompt, st.request)
      if (exact !== undefined) {
        prompt = exact
        $.ui.log(`${$.plugin.name}: added the user's request word for word to the ${role} handoff.`)
      }
      const ruled = role === 'gatekeeper' ? withRuledOn(prompt, st.raised) : undefined
      if (ruled !== undefined) prompt = ruled
      void ensureBaseChecks($, st)
      // the full checks run beside the review, so a gatekeeper's own run replays them
      if (role === 'gatekeeper' && st.cache !== undefined) void runChecksAhead($, st, { cwd: st.cache.root, base: false })
    }

    if (role !== undefined && CRITERIA_ROLES.includes(role)) {
      const block = criteriaBlock(prompt)
      if (block !== undefined) {
        savedCriteria = block
      } else if (savedCriteria !== undefined) {
        prompt = `${prompt.trimEnd()}\n\n${savedCriteria}`
        $.ui.log(`${$.plugin.name}: restored the ACCEPTANCE CRITERIA block in the ${role} handoff.`)
      }
    }

    const res = await next({ ...e, prompt })
    if (role && res.agentId) roleByAgent.set(res.agentId, role)
    return res
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const ran = await next(e)
    if (!gated || ran.deny !== undefined || ran.isError === true) return ran

    const result = ran.result as { status?: string; agentId?: string } | undefined
    if (result?.status !== 'completed') return ran

    const role = (result.agentId && roleByAgent.get(result.agentId)) || roleOf(e.subagent_type, e.prompt)
    if (role !== 'implementor') return ran

    const paths = await changedPaths($)
    if (paths === undefined || paths.some(isTestFile)) return ran

    const note =
      `${$.plugin.name}: this implementor run changed no test files. The acceptance criteria require tests; ` +
      'send it back unless the change genuinely needs none.'
    return { ...ran, context: [...(ran.context ?? []), note] }
  }).catch(($, e, next) => next(e))

  on('turn.start', ($, e, next) => {
    if (gated && e.agentId !== undefined && roleByAgent.get(e.agentId) === 'gatekeeper') st.runningGates.add(e.agentId)
    return next(e)
  }).catch(($, e, next) => next(e))

  // The extras that follow a subagent's end: a gatekeeper's must-fixes are
  // kept for RULED ON and its leftover probe files removed once no gatekeeper
  // runs; an implementor's or simplifier's end starts the full checks.
  on('turn.complete', async ($, e, next) => {
    await afterSubagent($, st, gated, roleByAgent, e)
    if (gated) {
      try {
        const usage = e.usage
        const role = e.agentId === undefined ? 'orchestrator' : roleByAgent.get(e.agentId) ?? 'other'
        const record: UsageRecord = {
          role,
          agentId: e.agentId,
          model: usage?.model ?? null,
          input_tokens: usage?.input_tokens ?? 0,
          output_tokens: usage?.output_tokens ?? 0,
          cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? 0,
          durationMs: e.durationMs,
          reason: e.reason,
        }
        if (e.agentId !== undefined) {
          const now = await $.clock.now().catch(() => undefined)
          if (now !== undefined) {
            record.endedAt = now
            record.startedAt = now - e.durationMs
          }
        }
        records.push(record)
        await appendUsageLine($, record)
      } catch (err) {
        $.ui.log(`${$.plugin.name}: could not record this turn: ${String((err as Error)?.message ?? err)}`)
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'ff-usage',
        description: 'Per-role tokens and time for feature-flow-lite runs in this session.',
      })
    } catch (err) {
      $.ui.log(`${$.plugin.name}: /ff-usage is not registered: ${String((err as Error)?.message ?? err)}`)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'ff-usage' }, async () => ({ text: usageTable(records) }))
}

// Appends one record to the file named by FEATURE_FLOW_USAGE_LOG, if set.
// A failure is logged and the run goes on.
async function appendUsageLine($: EngineInterface, record: UsageRecord): Promise<void> {
  const path = await $.env.get('FEATURE_FLOW_USAGE_LOG')
  if (!path) return
  try {
    const prior = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
    const lead = prior === '' || prior.endsWith('\n') ? '' : '\n'
    await $.fs.write(path, `${prior}${lead}${JSON.stringify(record)}\n`)
  } catch (err) {
    $.ui.log(`${$.plugin.name}: could not write the usage log ${path}: ${String((err as Error)?.message ?? err)}`)
  }
}

// The extras' state, for one invocation of the skill.
type ExtrasState = {
  cache: CacheSetup | undefined
  extras: boolean
  root: string | undefined
  lastUserText: string
  request: string
  raised: string[]
  baseStarted: boolean
  runningGates: Set<string>
  inflight: Set<string>
  // panel seats the mod started, waiting for their reports
  waiters: Map<string, (report: string) => void>
}

// The checks a project file lists, each with its st.cache key, run through the
// wrapper in the background. Runs of a key already in flight are skipped; an
// agent asking for the same check meanwhile waits on it and replays it.
async function runChecksAhead($: EngineInterface, st: ExtrasState, opts: { cwd: string; base: boolean }): Promise<void> {
  if (st.cache === undefined) return
  const setup = st.cache
  const checks = await readProjectChecks($, setup.root)
  for (const words of checks) {
    const tokens = tokenize(words.map(w => `'${w.replace(/'/g, `'\\''`)}'`).join(' '))
    const seg = tokens && segments(tokens)[0]
    const check = seg && checkOf(seg, checks)
    if (!check) continue
    const id = `${opts.base ? 'base' : 'tree'}:${check.key}`
    if (st.inflight.has(id)) continue
    st.inflight.add(id)
    const env: Record<string, string> = { FF_CACHE_ORIGIN: opts.base ? 'mod-base' : 'mod' }
    if (opts.base) env.FF_CACHE_BASE = '1'
    void $.process
      .run(['bash', setup.script, setup.dir, '-', check.family, check.key, '--', ...words], { cwd: opts.cwd, env, timeoutMs: 600_000 })
      .catch(() => undefined)
      .finally(() => st.inflight.delete(id))
  }
}

// The base commit's checks, once, on a worktree of the base commit (ignored
// paths such as node_modules linked in), so a later failure can be looked up.
async function ensureBaseChecks($: EngineInterface, st: ExtrasState): Promise<void> {
  if (!st.extras || st.cache === undefined || st.baseStarted) return
  if ((await readProjectChecks($, st.cache.root)).length === 0) return
  st.baseStarted = true
  try {
    const base = (await $.fs.read(`${st.cache.dir}/base`)).trim()
    const tmp = (await $.env.get('TMPDIR')) || '/tmp'
    const tree = `${tmp}/ff-base${st.cache.root.replace(/[^A-Za-z0-9]/g, '_')}`
    const made = await $.process.run(['bash', '-c', BASE_TREE, 'ff-base', st.cache.root, tree, base], { timeoutMs: 300_000 })
    if (made.exitCode !== 0) {
      $.ui.log(`${$.plugin.name}: no base-commit checks: ${made.stderr.trim().slice(0, 200)}`)
      return
    }
    await runChecksAhead($, st, { cwd: tree, base: true })
  } catch (err) {
    $.ui.log(`${$.plugin.name}: no base-commit checks: ${String((err as Error)?.message ?? err)}`)
  }
}

// The main conversation hands edits to the implementor: deny its edits to
// files in the repo, except the project file.
async function guardEdit($: EngineInterface, st: ExtrasState, gated: boolean, agentId: string | undefined, path: string | undefined): Promise<{ deny: string } | undefined> {
  if (!gated || !st.extras || agentId !== undefined || st.root === undefined || path === undefined) return undefined
  const inside = path === st.root || path.startsWith(`${st.root}/`)
  if (!inside || path === `${st.root}/FEATURE_FLOW.md`) return undefined
  return {
    deny:
      `${$.plugin.name}: the orchestrator doesn't edit the change itself. Send this edit to the implementor ` +
      '(continue it with SendMessage, or spawn one with a narrow handoff).',
  }
}
async function afterSubagent($: EngineInterface, st: ExtrasState, gated: boolean, roleByAgent: ReadonlyMap<string, Role>, e: { agentId?: string; answer: string }): Promise<void> {
  const waiter = e.agentId === undefined ? undefined : st.waiters.get(e.agentId)
  if (waiter !== undefined && e.agentId !== undefined) {
    st.waiters.delete(e.agentId)
    waiter(e.answer)
  }
  const role = e.agentId === undefined ? undefined : roleByAgent.get(e.agentId)
  if (gated && st.extras && e.agentId !== undefined && role !== undefined) {
    try {
      if (role === 'gatekeeper') {
        st.raised.push(...mustFixes(e.answer).filter(item => !st.raised.includes(item)))
        st.runningGates.delete(e.agentId)
        if (st.runningGates.size === 0) await removeProbes($)
      }
      if ((role === 'implementor' || role === 'simplifier') && st.cache !== undefined) {
        void runChecksAhead($, st, { cwd: st.cache.root, base: false })
      }
    } catch (err) {
      $.ui.log(`${$.plugin.name}: st.extras after a ${role} run failed: ${String((err as Error)?.message ?? err)}`)
    }
  }
}


type CacheSetup = { root: string; dir: string; script: string }

// Turns the check cache on for this invocation when FEATURE_FLOW_CHECK_CACHE=1:
// the cache lives in the repo's git dir (out of every diff), and the base
// commit is recorded there. The wrapper is the plugin's hooks/ffcc.sh. Undefined (cache off) when the variable is unset or git
// can't say where the repo is.
async function setUpCache($: EngineInterface): Promise<CacheSetup | undefined> {
  if ((await $.env.get('FEATURE_FLOW_CHECK_CACHE').catch(() => undefined)) !== '1') return undefined
  try {
    const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    const common = await $.process.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'])
    const head = await $.process.run(['git', 'rev-parse', 'HEAD'])
    if (top.exitCode !== 0 || common.exitCode !== 0) return undefined
    const root = top.stdout.trim()
    const dir = `${common.stdout.trim()}/ff-check-cache`
    const script = `${$.plugin.root}/hooks/ffcc.sh`
    if (!(await $.fs.exists(script))) return undefined
    await $.fs.write(`${dir}/base`, head.exitCode === 0 ? `${head.stdout.trim()}\n` : 'none\n')
    $.ui.log(`${$.plugin.name}: check cache on (${dir}).`)
    return { root, dir, script }
  } catch (err) {
    $.ui.log(`${$.plugin.name}: check cache off: ${String((err as Error)?.message ?? err)}`)
    return undefined
  }
}

// The project file's Checks, read on each call (the orchestrator may write it
// after the first check runs). None when it is missing.
async function readProjectChecks($: EngineInterface, root: string): Promise<string[][]> {
  try {
    const path = `${root}/FEATURE_FLOW.md`
    return (await $.fs.exists(path)) ? projectChecks(await $.fs.read(path)) : []
  } catch {
    return []
  }
}

// Makes (or reuses) a worktree of the base commit and links the main tree's
// ignored paths into it (node_modules, generated files, .venv), so checks run
// there without an install. $1 root, $2 worktree, $3 base commit.
const BASE_TREE = `set -e
root=$1 wt=$2 base=$3
[ -d "$wt" ] || git -C "$root" worktree add -q --detach "$wt" "$base"
cd "$root"
git ls-files --others --ignored --exclude-standard --directory | while IFS= read -r p; do
  p=\${p%/}
  case "$p" in .claude|.claude/*|.git|.git/*) continue ;; esac
  [ -e "$wt/$p" ] || [ -L "$wt/$p" ] || { mkdir -p "$wt/$(dirname "$p")"; ln -s "$root/$p" "$wt/$p"; }
done`

async function repoRoot($: EngineInterface): Promise<string | undefined> {
  try {
    const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    return top.exitCode === 0 ? top.stdout.trim() : undefined
  } catch {
    return undefined
  }
}

// Deletes untracked zz_gate_ / zz_redteam_ probe files a gatekeeper left.
async function removeProbes($: EngineInterface): Promise<void> {
  const left = (await changedPaths($))?.filter(isProbe) ?? []
  if (left.length === 0) return
  const top = await repoRoot($)
  if (top === undefined) return
  await $.process.run(['rm', '-f', '--', ...left.map(p => `${top}/${p}`)])
  $.ui.log(`${$.plugin.name}: removed probe files a gatekeeper left: ${left.join(', ')}`)
}
