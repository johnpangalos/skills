// Run with: node --test feature-flow-lite/codex/codex.test.mjs
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { criteriaBlock, isTestFile, roleOf, usageTable } from './hooks.mjs'
import { agentToml, mergeHooks } from './install.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOOKS = join(HERE, 'hooks.mjs')
const INSTALL = join(HERE, 'install.mjs')
const BLOCK = ['ACCEPTANCE CRITERIA:', '- Adds the flag.', '- Rejects an empty name.'].join('\n')

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'ff-repo-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

// Runs the hook script on one event and returns its stdout.
function hook(env, event) {
  const res = spawnSync('node', [HOOKS], { input: JSON.stringify(event), encoding: 'utf8', env: { ...process.env, ...env } })
  assert.equal(res.status, 0, res.stderr)
  return res.stdout
}

test('criteriaBlock stops at the next handoff header', () => {
  assert.equal(criteriaBlock(`GOAL: x\n${BLOCK}\n- UI: stays\nCHECKS: pytest`), `${BLOCK}\n- UI: stays`)
  assert.equal(criteriaBlock('GOAL: x'), undefined)
})

test('roleOf only knows the ff_ agents', () => {
  assert.equal(roleOf('ff_reviewer'), 'reviewer')
  assert.equal(roleOf('ff_other'), undefined)
  assert.equal(roleOf('worker'), undefined)
})

test('isTestFile', () => {
  for (const path of ['tests/a.py', 'pkg/x_test.go', 'src/a.test.ts', 'test_b.py']) assert.ok(isTestFile(path), path)
  for (const path of ['src/a.ts', 'testing.md']) assert.ok(!isTestFile(path), path)
})

test('a dropped criteria block comes back when the reviewer starts', () => {
  const env = { FEATURE_FLOW_CODEX_HOME: mkdtempSync(join(tmpdir(), 'ff-home-')) }
  const cwd = repo()
  const base = { session_id: 's1', cwd }
  hook(env, { ...base, hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', tool_input: { agent: 'ff_implementor', message: `GOAL: x\n${BLOCK}\nCHECKS: y` } })
  assert.equal(hook(env, { ...base, hook_event_name: 'SubagentStart', agent_type: 'ff_implementor', agent_id: 'a1' }), '')

  hook(env, { ...base, hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', tool_input: { agent: 'ff_reviewer', message: 'GOAL: review it' } })
  const out = JSON.parse(hook(env, { ...base, hook_event_name: 'SubagentStart', agent_type: 'ff_reviewer', agent_id: 'a2' }))
  assert.match(out.hookSpecificOutput.additionalContext, /Rejects an empty name/)

  // Only once, and not for other agents.
  assert.equal(hook(env, { ...base, hook_event_name: 'SubagentStart', agent_type: 'ff_reviewer', agent_id: 'a3' }), '')
  hook(env, { ...base, hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', tool_input: { agent: 'worker', message: 'x' } })
  assert.equal(hook(env, { ...base, hook_event_name: 'SubagentStart', agent_type: 'worker', agent_id: 'a4' }), '')

  // Invoking the skill again forgets them.
  hook(env, { ...base, hook_event_name: 'UserPromptSubmit', prompt: '$feature-flow-lite add a flag' })
  hook(env, { ...base, hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', tool_input: { agent: 'ff_reviewer', message: 'GOAL: y' } })
  assert.equal(hook(env, { ...base, hook_event_name: 'SubagentStart', agent_type: 'ff_reviewer', agent_id: 'a5' }), '')
})

test('an implementor with no changed test file is sent back once, then logged', () => {
  const env = { FEATURE_FLOW_CODEX_HOME: mkdtempSync(join(tmpdir(), 'ff-home-')) }
  const cwd = repo()
  const base = { session_id: 's1', cwd, agent_type: 'ff_implementor', agent_id: 'a1' }
  writeFileSync(join(cwd, 'app.py'), 'x = 1\n')
  hook(env, { ...base, hook_event_name: 'SubagentStart' })

  const first = JSON.parse(hook(env, { ...base, hook_event_name: 'SubagentStop', stop_hook_active: false }))
  assert.equal(first.decision, 'block')
  assert.equal(hook(env, { ...base, hook_event_name: 'SubagentStop', stop_hook_active: true }), '')

  writeFileSync(join(cwd, 'test_app.py'), 'def test(): pass\n')
  assert.equal(hook(env, { ...base, agent_id: 'a2', hook_event_name: 'SubagentStop', stop_hook_active: false }), '')

  const table = spawnSync('node', [HOOKS, 'usage', cwd], { encoding: 'utf8', env: { ...process.env, ...env } }).stdout
  assert.match(table, /implementor\s+2\s+-/)
})

test('usageTable counts only the orchestrator\'s last record', () => {
  const t = (input, output) => ({ input_tokens: input, cached_input_tokens: 0, output_tokens: output })
  const table = usageTable([
    { role: 'orchestrator', session_id: 's', tokens: t(10, 1), durationMs: 0 },
    { role: 'implementor', session_id: 's', tokens: t(5, 5), durationMs: 2000 },
    { role: 'orchestrator', session_id: 's', tokens: t(30, 3), durationMs: 0 },
  ])
  assert.match(table, /orchestrator\s+1\s+30\s+0\s+3/)
  assert.match(table, /total\s+2\s+35\s+0\s+8\s+2\.0/)
})

test('agentToml keeps the role prompt and pins effort', () => {
  const toml = agentToml('investigator', '---\nname: investigator\ndescription: Looks.\nmodel: haiku\neffort: low\n---\n\nRead `x`.\n')
  assert.match(toml, /^name = "ff_investigator"$/m)
  assert.match(toml, /^model_reasoning_effort = "low"$/m)
  assert.doesNotMatch(toml, /haiku/)
  assert.match(toml, /Read `x`\./)
  assert.match(agentToml('reviewer', '---\neffort: medium\n---\nx', 'small-model'), /^model = "small-model"$/m)
})

test('mergeHooks keeps other hooks and adds ours once', () => {
  const theirs = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'lint' }] }] } }
  const once = mergeHooks(theirs, 'node "/h/feature-flow-lite/hooks.mjs"')
  const twice = mergeHooks(once, 'node "/h/feature-flow-lite/hooks.mjs"')
  assert.deepEqual(twice, once)
  assert.equal(once.hooks.PreToolUse.length, 2)
  assert.deepEqual(mergeHooks(once, '', true), theirs)
})

test('install and uninstall in a scratch home', () => {
  const home = mkdtempSync(join(tmpdir(), 'ff-install-'))
  const env = { ...process.env, HOME: home, CODEX_HOME: join(home, '.codex') }
  const run = (...args) => {
    const res = spawnSync('node', [INSTALL, ...args], { encoding: 'utf8', env })
    assert.equal(res.status, 0, res.stderr)
  }
  run()
  for (const role of ['investigator', 'implementor', 'simplifier', 'reviewer']) {
    const file = join(home, '.codex', 'agents', `ff_${role}.toml`)
    assert.ok(existsSync(file), file)
    const py = spawnSync('python3', ['-c', 'import sys, tomllib; tomllib.load(open(sys.argv[1], "rb"))', file], { encoding: 'utf8' })
    if (py.error === undefined) assert.equal(py.status, 0, py.stderr)
  }
  assert.ok(existsSync(join(home, '.agents', 'skills', 'feature-flow-lite', 'SKILL.md')))
  assert.ok(existsSync(join(home, '.agents', 'skills', 'feature-flow-lite', 'templates', 'project-criteria.md')))
  const usage = readFileSync(join(home, '.agents', 'skills', 'ff-usage', 'SKILL.md'), 'utf8')
  assert.ok(usage.includes(join(home, '.codex', 'feature-flow-lite', 'hooks.mjs')))
  const hooks = JSON.parse(readFileSync(join(home, '.codex', 'hooks.json'), 'utf8')).hooks
  assert.deepEqual(Object.keys(hooks).sort(), ['PreToolUse', 'Stop', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit'])

  run() // idempotent
  assert.equal(JSON.parse(readFileSync(join(home, '.codex', 'hooks.json'), 'utf8')).hooks.Stop.length, 1)

  run('--uninstall')
  assert.ok(!existsSync(join(home, '.codex', 'agents', 'ff_reviewer.toml')))
  assert.ok(!existsSync(join(home, '.agents', 'skills', 'feature-flow-lite')))
  assert.deepEqual(JSON.parse(readFileSync(join(home, '.codex', 'hooks.json'), 'utf8')).hooks, {})
})
