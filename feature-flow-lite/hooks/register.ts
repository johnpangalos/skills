import type { EngineInterface, Register } from 'claude-code'

// feature-flow-lite's mod. Silent until the skill is invoked (a skill.prompt
// for feature-flow-lite); after that it keeps the ACCEPTANCE CRITERIA block in
// implementor and reviewer handoffs, flags implementor runs that changed no
// test file, flags new signatures with path-picking flag parameters after an
// implementor or simplifier run, flags simplifier edits outside the diff it was
// given, and records per-role tokens and time for /ff-usage. Every hook passes
// the event through unless its condition holds, and none of them can deny a
// spawn or a tool call.

type Role = 'investigator' | 'implementor' | 'simplifier' | 'reviewer'

const ROLES: readonly Role[] = ['investigator', 'implementor', 'simplifier', 'reviewer']
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
    const match = first?.trim().match(/^ROLE:\s*([a-z]+)$/)
    return match && isRole(match[1]) ? match[1] : undefined
  }
  return undefined
}

// The handoff headers that can follow the criteria. A criterion that merely
// starts in capitals ("UI: ...") is not one.
const HANDOFF_HEADER = /^(?:GOAL|FILES|CONSTRAINTS|HOSTILE INPUTS|CHECKS|PROJECT CHECKLIST|FOCUS|STATUS|SUMMARY|FILES TOUCHED|FINDINGS|OPEN QUESTIONS):/

// The ACCEPTANCE CRITERIA block: from its header line through the line before
// the next handoff header (CHECKS:, HOSTILE INPUTS:, ...), or the end.
function criteriaBlock(prompt: string): string | undefined {
  const lines = prompt.split('\n')
  const start = lines.findIndex(line => /^\s*ACCEPTANCE CRITERIA:/.test(line))
  if (start < 0) return undefined
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (HANDOFF_HEADER.test(lines[i])) {
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
  return (await statusEntries($))?.map(entry => entry.path)
}

async function statusEntries($: EngineInterface): Promise<{ path: string; untracked: boolean }[] | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', 'status', '--porcelain', '--untracked-files=all'])
    if (exitCode !== 0) return undefined
    return stdout
      .split('\n')
      .filter(line => line.length > 3)
      .map(line => ({ path: porcelainPath(line), untracked: line.startsWith('??') }))
  } catch {
    return undefined
  }
}

// A parameter that picks which path a caller takes: is_welcome=False,
// isRefund?: boolean, verbose bool, mode: 'a' | 'b'. Matched inside the
// parentheses of a line that opens a function.
const FUNCTION_LINE = /^\s*(?:export\s+)?(?:async\s+)?(?:def |func |function\b|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\()|^\s*(?:(?:public|private|protected|static|async)\s+)*(?!(?:if|for|while|switch|catch|with|return)\b)\w+\s*\([^)]*\)\s*(?::[^{=]+)?\{\s*$/
const FLAG_PARAM = [
  /\b(?:is|has|should|use|show|include|for|as)_\w+\b/,
  /\b(?:is|has|should)[A-Z]\w*\b/,
  /\b\w+\s*=\s*(?:True|False|true|false)\b/,
  /\b\w+\??\s*:\s*(?:bool|boolean)\b/,
  /(?:^|[(,\s])\w+\s+bool\b/,
  /\b(?:mode|kind|variant)\b\s*(?:[:=?,]|$)/,
]

function flagSignature(line: string): string | undefined {
  if (!FUNCTION_LINE.test(line)) return undefined
  const open = line.indexOf('(')
  if (open < 0) return undefined
  const close = line.lastIndexOf(')')
  const params = line.slice(open + 1, close > open ? close : undefined)
  return FLAG_PARAM.some(re => re.test(params)) ? line.trim() : undefined
}

// Added lines in the working tree against HEAD, with the file each is in:
// git diff for tracked files, the whole file for untracked ones.
async function addedLines($: EngineInterface): Promise<{ path: string; line: string }[] | undefined> {
  try {
    const diff = await $.process.run(['git', 'diff', 'HEAD', '--no-color', '--no-ext-diff', '-U0'])
    if (diff.exitCode !== 0) return undefined
    const out: { path: string; line: string }[] = []
    let path = ''
    for (const line of diff.stdout.split('\n')) {
      if (line.startsWith('+++ ')) path = line.slice(4).replace(/^b\//, '')
      else if (line.startsWith('+')) out.push({ path, line: line.slice(1) })
    }
    const entries = (await statusEntries($)) ?? []
    const untracked = entries.filter(entry => entry.untracked).slice(0, 50)
    if (untracked.length > 0) {
      const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
      const root = top.stdout.trim()
      for (const entry of untracked) {
        try {
          const text = await $.fs.read(root ? `${root}/${entry.path}` : entry.path)
          for (const line of text.split('\n')) out.push({ path: entry.path, line })
        } catch {
          // unreadable or too large to be a source file: skip it
        }
      }
    }
    return out
  } catch {
    return undefined
  }
}

async function flagNote($: EngineInterface, role: Role): Promise<string | undefined> {
  const lines = await addedLines($)
  if (lines === undefined) return undefined
  const found = lines.flatMap(({ path, line }) => {
    const signature = flagSignature(line)
    return signature ? [`${path}: ${signature}`] : []
  })
  if (found.length === 0) return undefined
  const shown = found.slice(0, 5).map(item => `  ${item}`)
  if (found.length > 5) shown.push(`  ...and ${found.length - 5} more`)
  return (
    `${$.plugin.name}: after this ${role} run, the diff has new signatures with flag parameters:\n${shown.join('\n')}\n` +
    'If a flag only picks which path one caller takes, inline the helper into its callers or split it. ' +
    'Leave it if the flag is a real option any caller may set.'
  )
}

const ROLE_ROW = (cells: readonly string[]) =>
  [cells[0].padEnd(14), ...cells.slice(1).map(cell => cell.padStart(12))].join(' ').trimEnd()

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

  on('skill.prompt', ($, e, next) => {
    // Each invocation is a new feature: forget the last one's criteria.
    if (isOurSkill(e.skill)) {
      gated = true
      savedCriteria = undefined
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    if (!gated) return next(e)

    const role = roleOf(e.subagentType, e.prompt)
    let prompt = e.prompt

    if (role === 'implementor' || role === 'reviewer') {
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
    // The simplifier's scope is the diff it was handed: what had changed when it started.
    const before = gated && roleOf(e.subagent_type, e.prompt) === 'simplifier' ? await fileStates($) : undefined

    const ran = await next(e)
    if (!gated || ran.deny !== undefined || ran.isError === true) return ran

    const result = ran.result
    if (result?.status !== 'completed') return ran

    const role = (result.agentId && roleByAgent.get(result.agentId)) || roleOf(e.subagent_type, e.prompt)
    if (role !== 'implementor' && role !== 'simplifier') return ran

    const notes: string[] = []
    if (role === 'implementor') {
      const paths = await changedPaths($)
      if (paths !== undefined && !paths.some(isTestFile)) {
        notes.push(
          `${$.plugin.name}: this implementor run changed no test files. The acceptance criteria require tests; ` +
            'send it back unless the change genuinely needs none.',
        )
      }
    }
    if (role === 'simplifier' && before !== undefined) {
      const after = await fileStates($)
      const outside = after === undefined ? [] : [...after].filter(path => !before.has(path))
      if (outside.length > 0) {
        notes.push(
          `${$.plugin.name}: the simplifier changed files outside the diff it was given: ${outside.join(', ')}. ` +
            'Its scope is the diff; revert those unless you asked for them.',
        )
      }
    }
    const flags = await flagNote($, role)
    if (flags) notes.push(flags)

    return notes.length === 0 ? ran : { ...ran, context: [...(ran.context ?? []), ...notes] }
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

// Changed paths at this moment, or undefined when git cannot say.
async function fileStates($: EngineInterface): Promise<Set<string> | undefined> {
  const paths = await changedPaths($)
  return paths === undefined ? undefined : new Set(paths)
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
