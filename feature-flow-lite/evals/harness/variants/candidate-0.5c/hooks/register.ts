import type { EngineInterface, Register } from 'claude-code'

// feature-flow-lite's mod. Silent until the skill is invoked (a skill.prompt
// for feature-flow-lite); after that it:
// - keeps the ACCEPTANCE CRITERIA and TRIGGERED CHECKS blocks in implementor
//   and reviewer handoffs, and puts each triggered check back in the exact
//   words of references/checks.md;
// - carries the reviewer's [blocking] findings into the next implementor
//   handoff, word for word;
// - escalates a [minor] finding that says a test can't fail;
// - notes the last fix round, and edits the main conversation makes itself;
// - flags implementor runs that changed no test file;
// - records per-role tokens and time for /ff-usage.
// Every hook passes the event through unless its condition holds, and none of
// them can deny a spawn or a tool call.

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
const HANDOFF_HEADER = /^(?:GOAL|FILES|CONSTRAINTS|HOSTILE INPUTS|CHECKS|PROJECT CHECKLIST|TRIGGERED CHECKS|APPROVED DIFFERENCES|REVIEWER'S BLOCKING FINDINGS|FINDINGS TO FIX|FOCUS|STATUS|SUMMARY|FILES TOUCHED|FINDINGS|OPEN QUESTIONS):/

// A handoff block: from its header line through the line before the next
// handoff header (CHECKS:, HOSTILE INPUTS:, ...), or the end.
function headerBlock(prompt: string, header: string): string | undefined {
  const lines = prompt.split('\n')
  const start = lines.findIndex(line => new RegExp(`^\\s*${header}:`).test(line))
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

const criteriaBlock = (prompt: string) => headerBlock(prompt, 'ACCEPTANCE CRITERIA')

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

// references/checks.md: each "## Title" section, in file order.
type Check = { title: string; text: string }

function parseChecks(md: string): Check[] {
  const checks: Check[] = []
  for (const part of md.split(/^## /m).slice(1)) {
    const title = (part.split('\n', 1)[0] ?? '').trim()
    const body = part.slice(part.indexOf('\n') + 1).trim()
    if (title && body) checks.push({ title, text: `## ${title}\n\n${body}` })
  }
  return checks
}

// The words that name a check in a paraphrase: its title up to the first comma
// or " and ", e.g. "Invariants" for "Invariants, round trips and equivalence".
function checkKey(title: string): string {
  return (title.split(/,| and /)[0] ?? title).trim().toLowerCase()
}

// A TRIGGERED CHECKS block with the exact text of every check it names that
// isn't already there word for word, inserted right after the header. It only
// adds: whatever the orchestrator wrote stays, in its order. Undefined when
// nothing needs adding.
function withExactChecks(block: string, checks: readonly Check[]): string | undefined {
  const lower = block.toLowerCase()
  const have = squash(block)
  const missing = checks.filter(
    c => (lower.includes(c.title.toLowerCase()) || lower.includes(checkKey(c.title))) && !have.includes(squash(c.text)),
  )
  if (missing.length === 0) return undefined
  const [header, ...rest] = block.split('\n')
  return [header, '', missing.map(c => c.text).join('\n\n'), ...(rest.length > 0 ? ['', ...rest] : [])].join('\n')
}

// Reviewer findings, one per line, from the result text: every line tagged
// [blocking] or [minor], as written.
function taggedLines(text: string, tag: 'blocking' | 'minor'): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.toLowerCase().includes(`[${tag}`))
}

// A finding that says a test can't catch the bug it is for.
const WEAK_TEST = new RegExp(
  [
    "test(?:s)? (?:that )?(?:can'?t|cannot|can not|could not|couldn'?t|doesn'?t|does not|never) (?:fail|catch|detect)",
    "(?:can'?t|cannot|doesn'?t|does not|never) fail",
    '(?:still )?pass(?:es|ed)? (?:with|without|even with|on|against) (?:the )?(?:lock|code|fix|change|guard|check)[^.;]*(?:removed|reverted|broken|deleted|unchanged|disabled|gone)',
    'passes? on the unchanged',
    "(?:wouldn'?t|would not|won'?t) (?:fail|catch)",
    'catch(?:es)? (?:a |the )?(?:lock|race)[^.;]* only (?:when|if) widened',
    '(?:would|will|does) (?:still )?pass (?:with|on|against|even with|despite) (?:the |this |that )?(?:bug|mutant|mutation|regression|broken)',
    "(?:can'?t|cannot|doesn'?t|does not) (?:see|observe|detect|notice) (?:the |this |that )?(?:bug|duplicate|race|regression|difference)",
  ].join('|'),
  'i',
)

function resultText(result: unknown): string {
  const content = (result as { content?: unknown })?.content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string' ? (block as { text: string }).text : ''))
    .join('\n')
}

// Paths the main conversation may write during a run: the project file, and
// anything outside the repo. With the repo root known, "outside" is literal;
// without it, the scratchpad and Claude's own folders are outside.
function mainMayEdit(path: string, repoRoot: string | undefined): boolean {
  if (/(?:^|\/)FEATURE_FLOW\.md$/.test(path) || /\/scratchpad\//.test(path) || /\/\.claude\//.test(path)) return true
  return repoRoot !== undefined && !path.startsWith(`${repoRoot.replace(/\/$/, '')}/`)
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
  let savedChecks: string | undefined
  let checks: Check[] | undefined
  let blocking: string[] = []
  let implementorSpawns = 0
  let repoRoot: string | undefined
  let pending: string[] = []
  const reviewed = new Set<string>()
  const roleByAgent = new Map<string, Role>()
  const records: UsageRecord[] = []

  on('skill.prompt', async ($, e, next) => {
    // Each invocation is a new feature: forget the last one's criteria.
    if (isOurSkill(e.skill)) {
      gated = true
      savedCriteria = undefined
      savedChecks = undefined
      blocking = []
      implementorSpawns = 0
      pending = []
      repoRoot = await repoTop($)
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

      const checkBlock = headerBlock(prompt, 'TRIGGERED CHECKS')
      if (checkBlock !== undefined) {
        checks ??= await loadChecks($)
        const exact = checks.length > 0 ? withExactChecks(checkBlock, checks) : undefined
        if (exact !== undefined) {
          prompt = prompt.replace(checkBlock, exact)
          $.ui.log(`${$.plugin.name}: added the exact words of references/checks.md to the TRIGGERED CHECKS in the ${role} handoff.`)
        }
        savedChecks = exact ?? checkBlock
      } else if (savedChecks !== undefined) {
        prompt = `${prompt.trimEnd()}\n\n${savedChecks}`
        $.ui.log(`${$.plugin.name}: restored the TRIGGERED CHECKS block in the ${role} handoff.`)
      }
    }

    if (role === 'implementor' && blocking.length > 0) {
      // Any findings section the orchestrator wrote itself (REVIEWER'S BLOCKING FINDINGS:,
      // FINDINGS TO FIX:, BLOCKING FINDINGS:) means they were carried.
      if (!/^\s*(?:[A-Z][A-Z' ]* )?FINDINGS[A-Z ]*:/m.test(prompt)) {
        prompt = `${prompt.trimEnd()}\n\nREVIEWER'S BLOCKING FINDINGS: (the reviewer's own words; fix each one)\n${blocking.map(line => `- ${line.replace(/^[-*]\s*/, '')}`).join('\n')}`
        $.ui.log(`${$.plugin.name}: added the reviewer's ${blocking.length} blocking finding(s) to the implementor handoff.`)
      }
      blocking = []
    }

    if (role === 'implementor') {
      implementorSpawns += 1
      if (implementorSpawns === 3) {
        pending.push(
          `${$.plugin.name}: this implementor call is the second fix round, the last one. After it, don't call the ` +
            'implementor again: report what passed, what still fails and the open findings.',
        )
      } else if (implementorSpawns > 3) {
        pending.push(
          `${$.plugin.name}: this is implementor call ${implementorSpawns}, past the two-fix-round cap. ` +
            'Stop after it and report what still fails.',
        )
      }
    }

    const res = await next({ ...e, prompt })
    if (role && res.agentId) roleByAgent.set(res.agentId, role)
    return res
  }).catch(($, e, next) => next(e))

  // Every tool result on the main loop: deliver queued notes, read a
  // reviewer's result, check an implementor run for tests, and note edits the
  // main conversation makes itself.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (!gated || e.agentId !== undefined || ran.deny !== undefined || ran.isError === true) return ran

    if (e.tool === 'Agent') {
      const result = ran.result as { status?: string; agentId?: string } | undefined
      if (result?.status === 'completed') {
        const role = (result.agentId && roleByAgent.get(result.agentId)) || roleOf(e.subagent_type, e.prompt)
        if (role === 'reviewer' && result.agentId !== undefined && !reviewed.has(result.agentId)) {
          reviewed.add(result.agentId)
          pending.push(...readReview($.plugin.name, resultText(result), lines => (blocking = lines)))
        }
        if (role === 'implementor') {
          const paths = await changedPaths($)
          if (paths !== undefined && !paths.some(isTestFile)) {
            pending.push(
              `${$.plugin.name}: this implementor run changed no test files. The acceptance criteria require tests; ` +
                'send it back unless the change genuinely needs none.',
            )
          }
        }
      }
    }

    if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit') {
      const args = e as { file_path?: unknown; notebook_path?: unknown }
      const note = mainEditNote($.plugin.name, args.file_path ?? args.notebook_path, repoRoot)
      if (note !== undefined) pending.push(note)
    }

    if (pending.length === 0) return ran
    const notes = pending
    pending = []
    for (const note of notes) $.ui.log(`${$.plugin.name}: delivered a note with the ${e.tool} result: ${note.split('\n')[0]}`)
    return { ...ran, context: [...(ran.context ?? []), ...notes] }
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (gated && e.agentId !== undefined && roleByAgent.get(e.agentId) === 'reviewer' && !reviewed.has(e.agentId)) {
      const answer = typeof e.answer === 'string' ? e.answer : ''
      if (/^\s*STATUS:/m.test(answer)) {
        reviewed.add(e.agentId)
        pending.push(...readReview($.plugin.name, answer, lines => (blocking = lines)))
      }
    }
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

// The note for an edit the main conversation made itself during a run: code
// and tests are the implementor's. None for the project file or files outside
// the repo.
function mainEditNote(plugin: string, path: unknown, repoRoot: string | undefined): string | undefined {
  const file = typeof path === 'string' ? path : ''
  if (file === '' || mainMayEdit(file, repoRoot)) return undefined
  return (
    `${plugin}: the main conversation edited ${file} itself. In a feature-flow-lite run, code and test ` +
    'edits go to the implementor, so the reviewer and the checks see who made each change.'
  )
}

// A reviewer's result: its [blocking] lines, plus any [minor] line that says a
// test can't fail, become the findings carried to the next implementor; the
// escalated ones also get a note.
function readReview(plugin: string, text: string, keep: (lines: string[]) => void): string[] {
  const weak = taggedLines(text, 'minor').filter(line => /test/i.test(line) && WEAK_TEST.test(line))
  keep([...taggedLines(text, 'blocking'), ...weak])
  if (weak.length === 0) return []
  return [
    `${plugin}: the reviewer tagged ${weak.length} finding(s) [minor] that say a test can't fail. ` +
      'The skill makes those [blocking]: send them to the implementor with the other blocking findings, ' +
      'or report them as open if no fix round is left.\n' +
      weak.map(line => `- ${line.replace(/^[-*]\s*/, '')}`).join('\n'),
  ]
}

// The repo's top folder, or undefined when git can't say.
async function repoTop($: EngineInterface): Promise<string | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    const top = stdout.trim()
    return exitCode === 0 && top !== '' ? top : undefined
  } catch {
    return undefined
  }
}

// references/checks.md from the plugin's folder, or none when it can't be read.
async function loadChecks($: EngineInterface): Promise<Check[]> {
  try {
    const md = await $.fs.read(`${$.plugin.root}/references/checks.md`)
    return parseChecks(typeof md === 'string' ? md : '')
  } catch (err) {
    $.ui.log(`${$.plugin.name}: could not read references/checks.md: ${String((err as Error)?.message ?? err)}`)
    return []
  }
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
