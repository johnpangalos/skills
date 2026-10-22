#!/usr/bin/env node
// feature-flow-lite's Codex hooks: the Codex port of hooks/register.ts. Codex
// runs it once per hook event with the event as JSON on stdin. It keeps the
// ACCEPTANCE CRITERIA block in implementor and reviewer handoffs, sends an
// implementor that changed no test file back once, and logs per-role tokens
// and time, which `node hooks.mjs usage` (the ff-usage skill) prints. It only
// acts on spawns of the ff_* agents and never denies a tool call.
//
// State lives in $FEATURE_FLOW_CODEX_HOME (default ~/.codex/feature-flow-lite),
// one file per repo: the latest criteria, whether the last spawn dropped them,
// and the start time of each running role.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROLES = ['investigator', 'implementor', 'simplifier', 'reviewer']
export const AGENT_PREFIX = 'ff_'
const ROLE_ORDER = ['orchestrator', ...ROLES]
// Criteria older than this belong to an earlier feature.
const CRITERIA_TTL_MS = 6 * 60 * 60 * 1000

export function roleOf(agentType) {
  if (typeof agentType !== 'string' || !agentType.startsWith(AGENT_PREFIX)) return undefined
  const name = agentType.slice(AGENT_PREFIX.length)
  return ROLES.includes(name) ? name : undefined
}

// The handoff headers that can follow the criteria. A criterion that merely
// starts in capitals ("UI: ...") is not one.
const HANDOFF_HEADER = /^(?:GOAL|FILES|CONSTRAINTS|HOSTILE INPUTS|CHECKS|PROJECT CHECKLIST|FOCUS|STATUS|SUMMARY|FILES TOUCHED|FINDINGS|OPEN QUESTIONS):/

// The ACCEPTANCE CRITERIA block: from its header line through the line before
// the next handoff header, or the end.
export function criteriaBlock(text) {
  const lines = text.split('\n')
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

// Every string inside a tool's arguments. Codex doesn't document spawn_agent's
// argument names, so the handoff and the agent type are looked for in all of them.
export function strings(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

// One porcelain line is "XY path", or "XY old -> new" for a rename.
function porcelainPath(line) {
  const rest = line.slice(3)
  const raw = rest.includes(' -> ') ? rest.slice(rest.lastIndexOf(' -> ') + 4) : rest
  return raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
    ? raw.slice(1, -1).replace(/\\(.)/g, '$1')
    : raw
}

const TEST_DIRS = new Set(['test', 'tests', '__tests__', 'spec'])
const TEST_BASENAME = /^test_|_test\.[^/]+$|\.test\.[^/]+$|\.spec\.[^/]+$/

export function isTestFile(path) {
  const parts = path.split('/')
  const base = parts.pop() ?? ''
  return parts.some(part => TEST_DIRS.has(part)) || TEST_BASENAME.test(base)
}

// Changed paths in the repo at cwd, or undefined when git cannot say.
function changedPaths(cwd) {
  try {
    const stdout = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return stdout
      .split('\n')
      .filter(line => line.length > 3)
      .map(porcelainPath)
  } catch {
    return undefined
  }
}

// The last token totals in a Codex transcript (its rollout JSONL), or
// undefined when the file has none. The format isn't documented, so this
// looks for any total_token_usage object and keeps the last one.
export function tokenTotals(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return undefined
  let last
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (value.total_token_usage && typeof value.total_token_usage === 'object') last = value.total_token_usage
    for (const child of Object.values(value)) visit(child)
  }
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      if (line.trim() === '') continue
      try {
        visit(JSON.parse(line))
      } catch {}
    }
  } catch {
    return undefined
  }
  if (!last) return undefined
  return {
    input_tokens: last.input_tokens ?? 0,
    cached_input_tokens: last.cached_input_tokens ?? 0,
    output_tokens: last.output_tokens ?? 0,
  }
}

const home = () => process.env.FEATURE_FLOW_CODEX_HOME || join(homedir(), '.codex', 'feature-flow-lite')
const repoKey = cwd => createHash('sha256').update(cwd ?? '').digest('hex').slice(0, 16)
const statePath = cwd => join(home(), 'state', `${repoKey(cwd)}.json`)
const usagePath = cwd => join(home(), 'usage', `${repoKey(cwd)}.jsonl`)

function readState(cwd) {
  try {
    return JSON.parse(readFileSync(statePath(cwd), 'utf8'))
  } catch {
    return { running: {} }
  }
}

function writeState(cwd, state) {
  mkdirSync(join(home(), 'state'), { recursive: true })
  writeFileSync(statePath(cwd), JSON.stringify(state))
}

function appendUsage(cwd, record) {
  mkdirSync(join(home(), 'usage'), { recursive: true })
  appendFileSync(usagePath(cwd), `${JSON.stringify(record)}\n`)
  const extra = process.env.FEATURE_FLOW_USAGE_LOG
  if (extra) appendFileSync(extra, `${JSON.stringify(record)}\n`)
}

const usageRecord = (role, event, durationMs, tokens) => ({
  role,
  session_id: event.session_id ?? null,
  agent_id: event.agent_id ?? null,
  model: event.model ?? null,
  tokens: tokens ?? null,
  durationMs,
  at: new Date().toISOString(),
})

// Each handler takes the event and returns what to print on stdout, if anything.
export const handlers = {
  // Invoking the skill starts a new feature: forget the last one's criteria.
  UserPromptSubmit(event) {
    if (!/\bfeature-flow-lite\b/.test(event.prompt ?? '')) return undefined
    const state = readState(event.cwd)
    delete state.criteria
    delete state.dropped
    writeState(event.cwd, state)
    return undefined
  },

  // A spawn that carries the criteria saves them; an implementor or reviewer
  // spawn that doesn't is marked so SubagentStart can add them back.
  PreToolUse(event) {
    if (!/^(?:spawn_agent|Agent)$/.test(event.tool_name ?? '')) return undefined
    const texts = strings(event.tool_input)
    const state = readState(event.cwd)
    const block = texts.map(criteriaBlock).find(found => found !== undefined)
    if (block !== undefined) {
      state.criteria = { text: block, at: Date.now() }
      state.dropped = false
    } else {
      state.dropped = texts.some(text => /\bff_(?:implementor|reviewer)\b/.test(text))
    }
    writeState(event.cwd, state)
    return undefined
  },

  SubagentStart(event) {
    const role = roleOf(event.agent_type)
    if (!role) return undefined
    const state = readState(event.cwd)
    state.running[event.agent_id ?? role] = Date.now()

    let output
    const fresh = state.criteria && Date.now() - state.criteria.at < CRITERIA_TTL_MS
    if ((role === 'implementor' || role === 'reviewer') && state.dropped && fresh) {
      output = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SubagentStart',
          additionalContext:
            'feature-flow-lite: the handoff dropped the acceptance criteria. These are the ' +
            `orchestrator's latest, word for word:\n\n${state.criteria.text}`,
        },
      })
    }
    state.dropped = false
    writeState(event.cwd, state)
    return output
  },

  // Logs the role's time and tokens. An implementor that changed no test file
  // is sent back once (stop_hook_active is set on the second stop).
  SubagentStop(event) {
    const role = roleOf(event.agent_type)
    if (!role) return undefined
    if (role === 'implementor' && !event.stop_hook_active) {
      const paths = changedPaths(event.cwd)
      if (paths !== undefined && !paths.some(isTestFile)) {
        return JSON.stringify({
          decision: 'block',
          reason:
            'feature-flow-lite: this run changed no test files. The acceptance criteria require ' +
            'tests, including one per hostile input. Add them, or say under FINDINGS why this ' +
            'change genuinely needs none, then return the result again.',
        })
      }
    }

    // The run is over: log it once, covering any round the check above added.
    const state = readState(event.cwd)
    const key = event.agent_id ?? role
    const started = state.running[key]
    appendUsage(event.cwd, usageRecord(role, event, started ? Date.now() - started : 0, tokenTotals(event.agent_transcript_path)))
    delete state.running[key]
    writeState(event.cwd, state)
    return undefined
  },

  // The orchestrator's running totals, once this session has run a role.
  Stop(event) {
    const records = readUsage(event.cwd).filter(r => r.session_id === event.session_id)
    if (!records.some(r => r.role !== 'orchestrator')) return undefined
    const tokens = tokenTotals(event.transcript_path)
    if (tokens) appendUsage(event.cwd, usageRecord('orchestrator', event, 0, tokens))
    return undefined
  },
}

function readUsage(cwd) {
  try {
    return readFileSync(usagePath(cwd), 'utf8')
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line))
  } catch {
    return []
  }
}

const row = cells => [cells[0].padEnd(14), ...cells.slice(1).map(cell => cell.padStart(12))].join(' ').trimEnd()

// The per-role table for the latest session in this repo that ran a role.
// Orchestrator totals are cumulative, so only its last record counts.
export function usageTable(records) {
  const latest = [...records].reverse().find(r => r.role !== 'orchestrator')
  if (!latest) return 'ff-usage: nothing recorded yet in this repo. Records start once a feature-flow-lite role runs.'
  const session = records.filter(r => r.session_id === latest.session_id)
  const orchestrator = session.filter(r => r.role === 'orchestrator').slice(-1)
  const kept = [...orchestrator, ...session.filter(r => r.role !== 'orchestrator')]

  const num = (rows, field) =>
    rows.some(r => r.tokens) ? String(rows.reduce((n, r) => n + (r.tokens?.[field] ?? 0), 0)) : '-'
  const cells = (name, rows) => [
    name,
    String(rows.length),
    num(rows, 'input_tokens'),
    num(rows, 'cached_input_tokens'),
    num(rows, 'output_tokens'),
    rows.some(r => r.durationMs) ? (rows.reduce((n, r) => n + r.durationMs, 0) / 1000).toFixed(1) : '-',
  ]
  const roles = ROLE_ORDER.filter(role => kept.some(r => r.role === role))
  return [
    `ff-usage (feature-flow-lite, Codex session ${latest.session_id ?? 'unknown'})`,
    row(['role', 'runs', 'input', 'cached input', 'output', 'seconds']),
    ...roles.map(role => row(cells(role, kept.filter(r => r.role === role)))),
    row(cells('total', kept)),
  ].join('\n')
}

async function readStdin() {
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  return text
}

async function main() {
  if (process.argv[2] === 'usage') {
    console.log(usageTable(readUsage(process.argv[3] ?? process.cwd())))
    return
  }
  let event
  try {
    event = JSON.parse(await readStdin())
  } catch {
    return
  }
  const handler = handlers[event.hook_event_name]
  if (!handler) return
  try {
    const output = handler(event)
    if (output) process.stdout.write(output)
  } catch (err) {
    // Never break the session: report and pass the event through.
    process.stderr.write(`feature-flow-lite: ${String(err?.message ?? err)}\n`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
