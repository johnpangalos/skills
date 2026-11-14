import type { EngineInterface, Register } from 'claude-code'
import { noteFor, parseNotes, planRewrite, projectChecks } from './check-cache'

// feature-flow-lite's mod. Silent until the skill is invoked (a skill.prompt
// for feature-flow-lite); after that it keeps the ACCEPTANCE CRITERIA block in
// implementor and reviewer handoffs, flags implementor runs that changed no
// test file, and records per-role tokens and time for /ff-usage. With
// FEATURE_FLOW_CHECK_CACHE=1 it also caches passing checks (check-cache.ts):
// every agent's check commands go through a wrapper that replays a pass on an
// unchanged tree instead of running it again. Every hook passes the event
// through unless its condition holds, and none of them can deny a spawn or a
// tool call.

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
  return ['ff-usage (feature-flow-lite, this session)', header, ...rows, total].join('\n')
}

export const register: Register = on => {
  let gated = false
  let savedCriteria: string | undefined
  const roleByAgent = new Map<string, Role>()
  const records: UsageRecord[] = []

  let cache: CacheSetup | undefined

  on('skill.prompt', async ($, e, next) => {
    // Each invocation is a new feature: forget the last one's criteria.
    if (isOurSkill(e.skill)) {
      gated = true
      savedCriteria = undefined
      cache = await setUpCache($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // The check cache: route each check in a Bash call through the wrapper, then
  // say what was replayed. Off unless FEATURE_FLOW_CHECK_CACHE=1.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!gated || cache === undefined) return next(e)
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

  on('turn.complete', async ($, e, next) => {
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

type CacheSetup = { root: string; dir: string; script: string }

// Turns the check cache on for this invocation when FEATURE_FLOW_CHECK_CACHE=1:
// the cache lives in the repo's git dir (out of every diff), and the base
// commit is recorded there. The wrapper is the plugin's hooks/ffcc.sh. Undefined (cache off) when the variable is unset or git
// can't say where the repo is.
async function setUpCache($: EngineInterface): Promise<CacheSetup | undefined> {
  if ((await $.env.get('FEATURE_FLOW_CHECK_CACHE')) !== '1') return undefined
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
