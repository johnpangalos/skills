#!/usr/bin/env node
// feature-flow-lite's Codex hooks: the Codex port of hooks/register.ts. Codex
// runs it once per hook event with the event as JSON on stdin. It puts the
// latest ACCEPTANCE CRITERIA block back into an implementor or reviewer
// spawn_agent call that drops it, sends an implementor that changed no test
// file back once, and logs per-role tokens and time, which `node hooks.mjs
// usage` (the ff-usage skill) prints. It only acts on the ff_* agents and never
// denies a tool call.
//
// Field names follow openai/codex (codex-rs): spawn_agent takes `message` (or
// `items`) and `agent_type`; subagent hooks run in the child with the parent's
// session_id, agent_id set to the child's thread id and agent_type to its role;
// a transcript's token_count events carry a cumulative `total_token_usage`.//
// State lives in $FEATURE_FLOW_CODEX_HOME (default ~/.codex/feature-flow-lite):
// the latest criteria per session, and a usage log per repo.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROLES = ['investigator', 'implementor', 'simplifier', 'reviewer']
export const AGENT_PREFIX = 'ff_'
const ROLE_ORDER = ['orchestrator', ...ROLES]

// Our roles: a named ff_ agent, or a default agent whose message opens with a
// ROLE line (the SKILL.md fallback).
export function roleOf(agentType, message) {
  if (typeof agentType === 'string' && agentType.startsWith(AGENT_PREFIX)) {
    const name = agentType.slice(AGENT_PREFIX.length)
    return ROLES.includes(name) ? name : undefined
  }
  const first = (message ?? '').split('\n').find(line => line.trim() !== '')
  const match = first?.trim().match(/^ROLE:\s*([a-z]+)$/)
  return match && ROLES.includes(match[1]) ? match[1] : undefined
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

// The handoff text of a spawn_agent call: `message`, or the text items.
function handoffText(input) {
  if (typeof input?.message === 'string') return input.message
  if (Array.isArray(input?.items)) {
    return input.items
      .filter(item => item?.type === 'text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('\n')
  }
  return ''
}

// The same call with the criteria appended to its handoff.
export function withCriteria(input, block) {
  if (typeof input.message === 'string') return { ...input, message: `${input.message.trimEnd()}\n\n${block}` }
  return { ...input, items: [...(input.items ?? []), { type: 'text', text: block }] }
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

// The thread's cumulative token totals from the last token_count event (or
// token_usage_record) in its transcript, or undefined when there is none.
export function tokenTotals(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return undefined
  let last
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      if (!line.includes('total_token_usage') && !line.includes('thread_token_usage')) continue
      try {
        const payload = JSON.parse(line)?.payload
        const usage = payload?.info?.total_token_usage ?? payload?.thread_token_usage
        if (usage) last = usage
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
const key = value => createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 16)
const statePath = sessionId => join(home(), 'state', `${key(sessionId)}.json`)
const usagePath = cwd => join(home(), 'usage', `${key(cwd)}.jsonl`)

function readState(sessionId) {
  try {
    return JSON.parse(readFileSync(statePath(sessionId), 'utf8'))
  } catch {
    return { started: {} }
  }
}

function writeState(sessionId, state) {
  mkdirSync(join(home(), 'state'), { recursive: true })
  writeFileSync(statePath(sessionId), JSON.stringify(state))
}

function appendUsage(cwd, record) {
  mkdirSync(join(home(), 'usage'), { recursive: true })
  appendFileSync(usagePath(cwd), `${JSON.stringify(record)}\n`)
  const extra = process.env.FEATURE_FLOW_USAGE_LOG
  if (extra) appendFileSync(extra, `${JSON.stringify(record)}\n`)
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

// Each handler takes the event and returns what to print on stdout, if anything.
export const handlers = {
  // Invoking the skill by name starts a new feature: forget the last one's criteria.
  UserPromptSubmit(event) {
    if (!/\$feature-flow-lite\b/.test(event.prompt ?? '')) return undefined
    const state = readState(event.session_id)
    delete state.criteria
    writeState(event.session_id, state)
    return undefined
  },

  // A spawn that carries the criteria saves them; an implementor or reviewer
  // spawn that drops them gets the saved block appended to its handoff.
  PreToolUse(event) {
    if (event.tool_name !== 'spawn_agent' || !event.tool_input || typeof event.tool_input !== 'object') return undefined
    const input = event.tool_input
    const text = handoffText(input)
    const role = roleOf(input.agent_type, text)
    if (!role) return undefined

    const state = readState(event.session_id)
    const block = criteriaBlock(text)
    if (block !== undefined) {
      state.criteria = block
      writeState(event.session_id, state)
      return undefined
    }
    if ((role !== 'implementor' && role !== 'reviewer') || !state.criteria) return undefined
    return JSON.stringify({
      systemMessage: `feature-flow-lite: restored the ACCEPTANCE CRITERIA block in the ${role} handoff.`,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: withCriteria(input, state.criteria),
      },
    })
  },

  SubagentStart(event) {
    if (!roleOf(event.agent_type)) return undefined
    const state = readState(event.session_id)
    state.started[event.agent_id] = Date.now()
    writeState(event.session_id, state)
    return undefined
  },

  // Runs at the end of each of a subagent's turns. An implementor that changed
  // no test file is sent back once (stop_hook_active is set on the retry);
  // otherwise the turn is logged with the thread's tokens so far.
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

    const started = readState(event.session_id).started[event.agent_id]
    appendUsage(event.cwd, {
      role,
      session_id: event.session_id ?? null,
      agent_id: event.agent_id ?? null,
      model: event.model ?? null,
      tokens: tokenTotals(event.agent_transcript_path) ?? null,
      durationMs: started ? Date.now() - started : null,
      at: new Date().toISOString(),
    })
    return undefined
  },

  // The orchestrator's tokens so far, once this session has run a role.
  Stop(event) {
    const records = readUsage(event.cwd).filter(r => r.session_id === event.session_id)
    if (!records.some(r => r.role !== 'orchestrator')) return undefined
    const tokens = tokenTotals(event.transcript_path)
    if (!tokens) return undefined
    appendUsage(event.cwd, {
      role: 'orchestrator',
      session_id: event.session_id ?? null,
      agent_id: null,
      model: event.model ?? null,
      tokens,
      durationMs: null,
      at: new Date().toISOString(),
    })
    return undefined
  },
}

const row = cells => [cells[0].padEnd(14), ...cells.slice(1).map(cell => cell.padStart(12))].join(' ').trimEnd()

// The per-role table for the latest session in this repo that ran a role.
// Tokens and time are cumulative per thread, so each agent (and the
// orchestrator) counts once, at its last record.
export function usageTable(records) {
  const latest = [...records].reverse().find(r => r.role !== 'orchestrator')
  if (!latest) return 'ff-usage: nothing recorded yet in this repo. Records start once a feature-flow-lite role runs.'
  const lastPerAgent = new Map()
  for (const r of records) {
    if (r.session_id === latest.session_id) lastPerAgent.set(r.role === 'orchestrator' ? 'orchestrator' : r.agent_id, r)
  }
  const kept = [...lastPerAgent.values()]

  const sum = (rows, pick) => {
    const known = rows.map(pick).filter(value => typeof value === 'number')
    return known.length === 0 ? undefined : known.reduce((n, value) => n + value, 0)
  }
  const cells = (name, rows) => {
    const seconds = sum(rows, r => r.durationMs)
    return [
      name,
      String(rows.length),
      ...['input_tokens', 'cached_input_tokens', 'output_tokens'].map(field => String(sum(rows, r => r.tokens?.[field]) ?? '-')),
      seconds === undefined ? '-' : (seconds / 1000).toFixed(1),
    ]
  }
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
