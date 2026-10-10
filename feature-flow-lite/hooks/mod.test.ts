import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

const BLOCK = ['ACCEPTANCE CRITERIA:', '- Adds the flag.', '- Rejects an empty name.'].join('\n')
const IMPLEMENTOR = 'feature-flow-lite:implementor'
const REVIEWER = 'feature-flow-lite:reviewer'
const AGENT_CALL = { tool: 'Agent', description: 'Build', prompt: 'GOAL: x' } as const

type GitStub = { exitCode: number; stdout: string } | 'reject'

// What sits beneath the plugin, recorded where a test reads it. Operations
// answer { value }; the Agent tool answers the result the test sets on `agent`.
function world(on: On, git: GitStub = { exitCode: 0, stdout: '' }, clash = false) {
  const spawned: string[] = []
  const logs: string[] = []
  const registered: string[] = []
  const gitCalls: string[][] = []
  const agent: { result: unknown; context?: string[] } = { result: completed('agent-9') }
  let sessionSeen = false
  let gitState = git

  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('agent.spawn', async ($, e) => {
    spawned.push(e.prompt)
    return { model: 'haiku', agentId: `agent-${spawned.length}` }
  })
  on('turn.complete', () => ({ text: '' }))
  on('session.start', ($, e) => {
    sessionSeen = true
    return { cwd: e.cwd }
  })
  on('command.register', ($, e) => {
    if (clash) throw new Error(`command ${e.name} is taken`)
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('process.run', async ($, e) => {
    gitCalls.push([...e.argv])
    if (gitState === 'reject') throw new Error('spawn git ENOENT')
    const { exitCode, stdout } = gitState
    return { value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.log', ($, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('tool.call', { tool: 'Agent' }, async () => ({ result: agent.result, ...(agent.context ? { context: agent.context } : {}) }) as never)

  return {
    spawned,
    logs,
    registered,
    gitCalls,
    agent,
    setGit(next: GitStub) {
      gitState = next
    },
    get sessionSeen() {
      return sessionSeen
    },
  }
}

function completed(agentId: string) {
  return { status: 'completed', agentId, content: [], prompt: '' }
}

const ran = ($: { tool: { call: (input: never) => Promise<{ context?: readonly string[] }> } }, subagent: string) =>
  $.tool.call({ ...AGENT_CALL, subagent_type: subagent } as never)

const usageOf = (text: string) => text.split('\n').map(line => line.trim().split(/\s+/))

test('nothing is touched before feature-flow-lite is invoked', async ($, on) => {
  const w = world(on)
  await $.agent.spawn({ prompt: `ROLE: implementor\n${BLOCK}`, subagentType: 'general-purpose' })
  await $.skill.prompt({ skill: 'commit', text: 'c' })
  await $.skill.prompt({ skill: 'feature-flow', text: 'f' })
  await $.agent.spawn({ prompt: 'ROLE: implementor\nGOAL: second', subagentType: 'general-purpose' })

  expect(w.spawned[1]).toBe('ROLE: implementor\nGOAL: second')
  expect(w.logs).toEqual([])
})

test('skill.prompt passes its text through and opens the gate, with or without a plugin prefix', async ($, on) => {
  const w = world(on)
  expect(await $.skill.prompt({ skill: 'feature-flow-lite', text: 'body' })).toEqual({ text: 'body' })
  await $.skill.prompt({ skill: 'pangalos:feature-flow-lite', text: 'body' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: b', subagentType: IMPLEMENTOR })

  expect(w.spawned[1]).toBe(`GOAL: b\n\n${BLOCK}`)
})

test('roles: only the named agents and ROLE-first general-purpose prompts are ours', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })

  await $.agent.spawn({ prompt: 'GOAL: x', subagentType: 'feature-flow-lite:implementor-extra' })
  await $.agent.spawn({ prompt: 'GOAL: y\nSee ROLE: implementor below.', subagentType: 'general-purpose' })
  await $.agent.spawn({ prompt: 'GOAL: z', subagentType: 'Explore' })
  await $.agent.spawn({ prompt: 'GOAL: q', subagentType: 'other-plugin:implementor' })

  expect(w.spawned.slice(1)).toEqual(['GOAL: x', 'GOAL: y\nSee ROLE: implementor below.', 'GOAL: z', 'GOAL: q'])
})

test('roles: a ROLE line after leading blank lines is ours and gets the block', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: '\n  \nROLE: reviewer\nGOAL: b', subagentType: 'general-purpose' })

  expect(w.spawned[1]).toBe(`\n  \nROLE: reviewer\nGOAL: b\n\n${BLOCK}`)
})

test('handoff: a missing block is restored on the next implementor or reviewer, logged once', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\nFILES: x\n${BLOCK}\nCHECKS: npm test`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: b', subagentType: REVIEWER })

  expect(w.spawned[1]).toBe(`GOAL: b\n\n${BLOCK}`)
  expect(w.logs.filter(line => line.includes('restored'))).toHaveLength(1)
})

test('handoff: the saved block stops at the next handoff header', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}\nCHECKS: npm test`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: b', subagentType: IMPLEMENTOR })

  expect(w.spawned[1]).toBe(`GOAL: b\n\n${BLOCK}`)
  expect(w.spawned[1]).not.toContain('CHECKS:')
})

test('handoff: a prompt with the header is left alone, even when its block differs', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })
  const other = 'GOAL: b\nACCEPTANCE CRITERIA:\n- Something else.'
  await $.agent.spawn({ prompt: other, subagentType: IMPLEMENTOR })

  expect(w.spawned[1]).toBe(other)
  expect(w.logs).toEqual([])
})

test('handoff: a criteria line in capitals does not end the block', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const block = `${BLOCK}\nUI: the flag shows in --help.`
  await $.agent.spawn({ prompt: `GOAL: a\n${block}\nCHECKS: npm test`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: b', subagentType: REVIEWER })

  expect(w.spawned[1]).toBe(`GOAL: b\n\n${block}`)
})

test('handoff: the latest block seen is the one restored', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })
  const later = 'ACCEPTANCE CRITERIA:\n- Something else.'
  await $.agent.spawn({ prompt: `GOAL: b\n${later}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: c', subagentType: REVIEWER })

  expect(w.spawned[2]).toBe(`GOAL: c\n\n${later}`)
})

test('handoff: invoking the skill again forgets the last feature\'s criteria', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: 'GOAL: second feature', subagentType: IMPLEMENTOR })

  expect(w.spawned[1]).toBe('GOAL: second feature')
  expect(w.logs).toEqual([])
})

test('handoff: a lower-case mention mid-sentence is not a header', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })
  const prompt = 'GOAL: b\nThe acceptance criteria: be strict about it.'
  await $.agent.spawn({ prompt, subagentType: REVIEWER })

  expect(w.spawned[1]).toBe(`${prompt}\n\n${BLOCK}`)
})

test('handoff: investigator and simplifier spawns are never rewritten', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: i', subagentType: 'feature-flow-lite:investigator' })
  await $.agent.spawn({ prompt: 'GOAL: s', subagentType: 'feature-flow-lite:simplifier' })

  expect(w.spawned.slice(1)).toEqual(['GOAL: i', 'GOAL: s'])
})

test('handoff: back-to-back spawns missing the block each get it once, and a re-run adds nothing', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: b', subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: c', subagentType: REVIEWER })
  await $.agent.spawn({ prompt: w.spawned[1], subagentType: IMPLEMENTOR })

  const count = (text: string) => text.split('ACCEPTANCE CRITERIA:').length - 1
  expect(count(w.spawned[1])).toBe(1)
  expect(count(w.spawned[2])).toBe(1)
  expect(w.spawned[3]).toBe(w.spawned[1])
})

test('tests check: an implementor run that changed no test file gets a note', async ($, on) => {
  const w = world(on, { exitCode: 0, stdout: ' M feature-flow-lite/SKILL.md\n?? feature-flow-lite/hooks/register.ts\n' })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, IMPLEMENTOR)

  expect(out.context?.[0]).toMatch(/changed no test files/)
  expect(w.gitCalls[0]).toEqual(['git', 'status', '--porcelain', '--untracked-files=all'])
})

test('tests check: existing context is kept and the note added after it', async ($, on) => {
  const w = world(on, { exitCode: 0, stdout: ' M src/a.ts\n' })
  w.agent.context = ['earlier']
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, IMPLEMENTOR)

  expect(out.context).toHaveLength(2)
  expect(out.context?.[0]).toBe('earlier')
  expect(out.context?.[1]).toMatch(/no test files/)
})

test('tests check: a changed test file means no note', async ($, on) => {
  world(on, { exitCode: 0, stdout: ' M src/a.ts\n?? feature-flow-lite/hooks/register.test.ts\n' })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, IMPLEMENTOR)

  expect(out.context).toBeUndefined()
})

test('tests check: test-file names and folders are recognised, look-alikes are not', async ($, on) => {
  const cases: [string, boolean][] = [
    ['tests/parse.ts', true],
    ['pkg/__tests__/x.js', true],
    ['spec/x.rb', true],
    ['pkg/foo_test.go', true],
    ['pkg/test_util.py', true],
    ['web/app.spec.tsx', true],
    ['contest.py', false],
    ['latest.go', false],
    ['src/testimony.md', false],
  ]
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  for (const [path, isTest] of cases) {
    w.setGit({ exitCode: 0, stdout: ` M ${path}\n` })
    const out = await ran($, IMPLEMENTOR)
    expect([path, out.context === undefined]).toEqual([path, isTest])
  }
})

test('tests check: a rename counts by its new path, and quoted paths with spaces parse', async ($, on) => {
  const w = world(on, { exitCode: 0, stdout: 'R  src/parse.ts -> tests/parse_test.ts\n' })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  expect((await ran($, IMPLEMENTOR)).context).toBeUndefined()

  w.setGit({ exitCode: 0, stdout: 'R  tests/a.test.ts -> src/a.ts\n M "docs/my notes.md"\n' })
  expect((await ran($, IMPLEMENTOR)).context?.[0]).toMatch(/no test files/)
})

test('tests check: git exiting non-zero leaves the result unchanged', async ($, on) => {
  world(on, { exitCode: 128, stdout: '' })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, IMPLEMENTOR)

  expect(out.context).toBeUndefined()
  expect(out.result).toEqual(completed('agent-9'))
})

test('tests check: a git that cannot start leaves the result unchanged', async ($, on) => {
  world(on, 'reject')
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  expect((await ran($, IMPLEMENTOR)).context).toBeUndefined()
})

test('tests check: a background run passes through without git', async ($, on) => {
  const w = world(on, { exitCode: 0, stdout: '' })
  w.agent.result = { status: 'async_launched', agentId: 'agent-5', description: 'x', prompt: '', outputFile: '/o' }
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, IMPLEMENTOR)

  expect(out.context).toBeUndefined()
  expect(w.gitCalls).toHaveLength(0)
})

test('tests check: a reviewer run is not checked', async ($, on) => {
  const w = world(on, { exitCode: 0, stdout: ' M src/a.ts\n' })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, REVIEWER)

  expect(out.context).toBeUndefined()
  expect(w.gitCalls).toHaveLength(0)
})

test('tests check: an implementor known by its spawned agentId is checked when the call names no role', async ($, on) => {
  const w = world(on, { exitCode: 0, stdout: ' M src/a.ts\n' })
  w.agent.result = completed('agent-1')
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: 'ROLE: implementor\nGOAL: x', subagentType: 'general-purpose' })
  const out = await ran($, 'general-purpose')

  expect(out.context?.[0]).toMatch(/no test files/)
})

test('usage: nothing is recorded before the gate; /ff-usage says so', async ($, on) => {
  world(on)
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't0', reason: 'answer', usage: usage(10, 5) })
  const out = await $.command.run({ command: 'ff-usage', args: '', origin: { kind: 'composer' }, presentation: presentation() })
  expect(out.text).toMatch(/nothing recorded/)
})

test('usage: per-role totals, unknown agents as other, and an aborted turn with no usage records zeros', async ($, on) => {
  world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: 'ROLE: implementor\nGOAL: x', subagentType: 'general-purpose' })
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer', usage: usage(100, 50, 1000, 200) })
  await $.turn.complete({ answer: '', durationMs: 4000, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'agent-1', usage: usage(10, 20, 0, 5) })
  await $.turn.complete({ answer: '', durationMs: 500, isAborted: false, turnId: 't3', reason: 'answer', agentId: 'zz' })
  await $.turn.complete({ answer: '', durationMs: 300, isAborted: true, turnId: 't4', reason: 'aborted' })

  const out = await $.command.run({ command: 'ff-usage', args: '', origin: { kind: 'composer' }, presentation: presentation() })
  const rows = usageOf(out.text)
  expect(rows.find(cells => cells[0] === 'total')).toEqual(['total', '4', '110', '70', '1000', '205', '6.8'])
  expect(rows.find(cells => cells[0] === 'implementor')).toEqual(['implementor', '1', '10', '20', '0', '5', '4.0'])
  expect(rows.find(cells => cells[0] === 'other')).toEqual(['other', '1', '0', '0', '0', '0', '0.5'])
})

test('usage: a turn with no usage records zero tokens without crashing', async ($, on) => {
  world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.turn.complete({ answer: '', durationMs: 300, isAborted: true, turnId: 't4', reason: 'aborted' })
  const out = await $.command.run({ command: 'ff-usage', args: '', origin: { kind: 'composer' }, presentation: presentation() })
  expect(usageOf(out.text).find(cells => cells[0] === 'total')).toEqual(['total', '1', '0', '0', '0', '0', '0.3'])
})

test('usage: /ff-usage is registered at session start', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(w.registered).toEqual(['ff-usage'])
  expect(w.sessionSeen).toBe(true)
})

test('usage: a name clash on /ff-usage does not stop session.start', async ($, on) => {
  const w = world(on, { exitCode: 0, stdout: '' }, true)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(w.sessionSeen).toBe(true)
  expect(w.registered).toEqual([])
})

test('usage: each record is appended as one JSON line to FEATURE_FLOW_USAGE_LOG', async ($, on) => {
  world(on)
  const files: Record<string, string> = {}
  mock.env(on, { FEATURE_FLOW_USAGE_LOG: '/logs/usage.jsonl' })
  on('fs.exists', ($, e) => ({ value: e.path in files }))
  on('fs.read', ($, e) => ({ value: files[e.path] }))
  on('fs.write', ($, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })

  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', usage: usage(1, 2, 3, 4) })
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't2', reason: 'answer', usage: usage(5, 6) })

  const lines = files['/logs/usage.jsonl'].trim().split('\n').map(line => JSON.parse(line))
  expect(lines).toHaveLength(2)
  expect(lines[0]).toMatchObject({ role: 'orchestrator', input_tokens: 1, output_tokens: 2, durationMs: 1000, reason: 'answer' })
  expect(lines[1]).toMatchObject({ role: 'orchestrator', input_tokens: 5, output_tokens: 6, durationMs: 2000 })
})

test('usage: an unwritable FEATURE_FLOW_USAGE_LOG logs a line and the run goes on', async ($, on) => {
  const w = world(on)
  mock.env(on, { FEATURE_FLOW_USAGE_LOG: '/ro/usage.jsonl' })
  on('fs.exists', () => ({ value: false }))
  on('fs.write', () => {
    throw new Error('EACCES: permission denied')
  })

  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', usage: usage(1, 2) })

  expect(w.logs.some(line => line.includes('could not write the usage log'))).toBe(true)
  const out = await $.command.run({ command: 'ff-usage', args: '', origin: { kind: 'composer' }, presentation: presentation() })
  expect(usageOf(out.text).find(cells => cells[0] === 'total')).toEqual(['total', '1', '1', '2', '0', '0', '1.0'])
})

function usage(input: number, output: number, cacheRead = 0, cacheWrite = 0) {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheWrite,
    model: 'claude-haiku-5-5',
  }
}

function presentation() {
  return { isFullscreen: false, width: 80 } as never
}
