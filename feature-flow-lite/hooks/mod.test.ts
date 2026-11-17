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
  let root = '/work/repo'

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
    if (e.argv.includes('rev-parse')) {
      if (gitState === 'reject') throw new Error('spawn git ENOENT')
      return root === ''
        ? { value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
        : { value: { exitCode: 0, stdout: `${root}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
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
    setRoot(next: string) {
      root = next
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

test('handoff: a reviewer\'s PROJECT CHECKLIST ends the saved block', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}\nPROJECT CHECKLIST: 360px wide`, subagentType: REVIEWER })
  await $.agent.spawn({ prompt: 'GOAL: b', subagentType: IMPLEMENTOR })

  expect(w.spawned[1]).toBe(`GOAL: b\n\n${BLOCK}`)
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
  for (const [path, isTest] of cases) {
    // a fresh run per case, so the fix-round cap's note never mixes in
    await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
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

// ---- candidate-0.5c additions -------------------------------------------------

const CHECKS_MD = [
  '# Triggered checks',
  '',
  'Intro text.',
  '',
  '## Shared state',
  '',
  '- **Trigger:** state kept between calls.',
  '- **Check:** 8 threads on one key.',
  '',
  '## Invariants, round trips and equivalence',
  '',
  '- **Trigger:** something must always hold.',
  '- **Check:** a property test.',
  '',
  '## Command output',
  '',
  '- **Trigger:** a CLI flag.',
  '- **Check:** write to /dev/full.',
].join('\n')

const SHARED = '## Shared state\n\n- **Trigger:** state kept between calls.\n- **Check:** 8 threads on one key.'
const INVARIANTS = '## Invariants, round trips and equivalence\n\n- **Trigger:** something must always hold.\n- **Check:** a property test.'

function withChecks(on: On, md: string | 'missing' = CHECKS_MD) {
  const reads: string[] = []
  on('fs.read', ($, e) => {
    reads.push(e.path)
    if (md === 'missing') throw new Error('ENOENT')
    return { value: md }
  })
  return reads
}

function reviewed(text: string, agentId = 'agent-r') {
  return { status: 'completed', agentId, content: [{ type: 'text', text }], prompt: '' }
}

test('checks: a paraphrased TRIGGERED CHECKS block gets the exact words of checks.md added, and keeps its own', async ($, on) => {
  const w = world(on)
  const reads = withChecks(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({
    prompt: `GOAL: a\n${BLOCK}\nTRIGGERED CHECKS:\n- Shared state: hammer it with threads.\n- Invariants: property test the cap.\nCHECKS: npm test`,
    subagentType: IMPLEMENTOR,
  })

  expect(w.spawned[0]).toBe(
    `GOAL: a\n${BLOCK}\nTRIGGERED CHECKS:\n\n${SHARED}\n\n${INVARIANTS}\n\n- Shared state: hammer it with threads.\n- Invariants: property test the cap.\nCHECKS: npm test`,
  )
  expect(reads[0]).toMatch(/references\/checks\.md$/)
  expect(w.logs.some(line => line.includes('added the exact words of references/checks.md'))).toBe(true)
})

test('checks: an exact block is left alone, and a dropped one is restored in fix rounds and re-reviews', async ($, on) => {
  const w = world(on)
  withChecks(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const exact = `TRIGGERED CHECKS:\n\n${SHARED}`
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}\n${exact}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: `GOAL: fix\n${BLOCK}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: `GOAL: re-review\n${BLOCK}`, subagentType: REVIEWER })

  expect(w.spawned[0]).toBe(`GOAL: a\n${BLOCK}\n${exact}`)
  expect(w.spawned[1]).toBe(`GOAL: fix\n${BLOCK}\n\n${exact}`)
  expect(w.spawned[2]).toBe(`GOAL: re-review\n${BLOCK}\n\n${exact}`)
  expect(w.logs.filter(line => line.includes('restored the TRIGGERED CHECKS'))).toHaveLength(2)
})

test('checks: a block naming no known check is kept as written', async ($, on) => {
  const w = world(on)
  withChecks(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const prompt = `GOAL: a\n${BLOCK}\nTRIGGERED CHECKS: none`
  await $.agent.spawn({ prompt, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: `GOAL: b\n${BLOCK}`, subagentType: REVIEWER })

  expect(w.spawned[0]).toBe(prompt)
  expect(w.spawned[1]).toBe(`GOAL: b\n${BLOCK}\n\nTRIGGERED CHECKS: none`)
})

test('checks: an unreadable checks.md keeps the block as written and logs once', async ($, on) => {
  const w = world(on)
  withChecks(on, 'missing')
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const prompt = `GOAL: a\n${BLOCK}\nTRIGGERED CHECKS:\n- Shared state: threads.`
  await $.agent.spawn({ prompt, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt, subagentType: REVIEWER })

  expect(w.spawned).toEqual([prompt, prompt])
  expect(w.logs.filter(line => line.includes('could not read references/checks.md'))).toHaveLength(1)
})

test('checks: investigator and simplifier handoffs never get the block', async ($, on) => {
  const w = world(on)
  withChecks(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: a\n${BLOCK}\nTRIGGERED CHECKS:\n\n${SHARED}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: 'GOAL: simplify', subagentType: 'feature-flow-lite:simplifier' })

  expect(w.spawned[1]).toBe('GOAL: simplify')
})

const REVIEW = [
  'STATUS: fail',
  'FINDINGS:',
  '- [blocking] refund() races: 2 of 8 threads over-refund (probe: python3 /tmp/p/race.py -> total 40.00 > 31.77).',
  "- [minor] TEST THAT CAN'T FAIL: test_ids_unique passes with the lock removed.",
  '- [minor] unhashable key gives TypeError.',
  "- [minor] check.sh doesn't fail when ruff is missing.",
  'CHECKS: python3 race.py -> fail',
].join('\n')

test('findings: a [minor] test-that-can\'t-fail gets a note, and other minors do not', async ($, on) => {
  const w = world(on)
  w.agent.result = reviewed(REVIEW)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, REVIEWER)

  expect(out.context).toHaveLength(1)
  expect(out.context?.[0]).toMatch(/1 finding\(s\) \[minor\] that say a test can't fail/)
  expect(out.context?.[0]).toContain('test_ids_unique passes with the lock removed')
  expect(out.context?.[0]).not.toContain('unhashable')
  expect(out.context?.[0]).not.toContain('ruff')
})

test('findings: the reviewer\'s blocking findings, escalated ones included, go into the next implementor handoff once', async ($, on) => {
  const w = world(on)
  w.agent.result = reviewed(REVIEW)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await ran($, REVIEWER)
  await $.agent.spawn({ prompt: `GOAL: fix the race\n${BLOCK}`, subagentType: IMPLEMENTOR })
  await $.agent.spawn({ prompt: `GOAL: again\n${BLOCK}`, subagentType: IMPLEMENTOR })

  expect(w.spawned[0]).toBe(
    `GOAL: fix the race\n${BLOCK}\n\nREVIEWER'S BLOCKING FINDINGS: (the reviewer's own words; fix each one)\n` +
      '- [blocking] refund() races: 2 of 8 threads over-refund (probe: python3 /tmp/p/race.py -> total 40.00 > 31.77).\n' +
      "- [minor] TEST THAT CAN'T FAIL: test_ids_unique passes with the lock removed.",
  )
  expect(w.spawned[1]).toBe(`GOAL: again\n${BLOCK}`)
})

test('findings: a handoff that already has the section is left alone, and a reviewer handoff never gets it', async ($, on) => {
  const w = world(on)
  w.agent.result = reviewed(REVIEW)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await ran($, REVIEWER)
  await $.agent.spawn({ prompt: `GOAL: re-review\n${BLOCK}`, subagentType: REVIEWER })
  const own = `GOAL: fix\n${BLOCK}\nREVIEWER'S BLOCKING FINDINGS:\n- the race`
  await $.agent.spawn({ prompt: own, subagentType: IMPLEMENTOR })

  expect(w.spawned[0]).toBe(`GOAL: re-review\n${BLOCK}`)
  expect(w.spawned[1]).toBe(own)
})

test('findings: a clean review carries nothing', async ($, on) => {
  const w = world(on)
  w.agent.result = reviewed('STATUS: pass\nFINDINGS:\n- [minor] naming nit.\nCHECKS: all pass')
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, REVIEWER)
  await $.agent.spawn({ prompt: `GOAL: polish\n${BLOCK}`, subagentType: IMPLEMENTOR })

  expect(out.context ?? []).toEqual([])
  expect(w.spawned[0]).toBe(`GOAL: polish\n${BLOCK}`)
})

test('rounds: the third implementor spawn is the last fix round, a fourth is past the cap, and a new run resets', async ($, on) => {
  world(on, { exitCode: 0, stdout: ' M tests/test_a.py\n' })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const notes: (readonly string[] | undefined)[] = []
  for (let i = 0; i < 4; i++) {
    await $.agent.spawn({ prompt: `GOAL: ${i}`, subagentType: IMPLEMENTOR })
    notes.push((await ran($, IMPLEMENTOR)).context)
  }
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: 'GOAL: next run', subagentType: IMPLEMENTOR })
  const nextRun = await ran($, IMPLEMENTOR)

  expect(notes[0] ?? []).toEqual([])
  expect(notes[1] ?? []).toEqual([])
  expect(notes[2]?.[0]).toMatch(/second fix round, the last one/)
  expect(notes[3]?.[0]).toMatch(/implementor call 4, past the two-fix-round cap/)
  expect(nextRun.context ?? []).toEqual([])
})

test('rounds: a background launch still carries the last-round note', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  for (let i = 0; i < 3; i++) await $.agent.spawn({ prompt: `GOAL: ${i}`, subagentType: IMPLEMENTOR })
  w.agent.result = { status: 'async_launched', agentId: 'agent-3', prompt: '', description: 'x', outputFile: '/tmp/o' }
  const out = await ran($, IMPLEMENTOR)

  expect(out.context?.[0]).toMatch(/second fix round, the last one/)
})

test('rounds: the round note and the no-tests note can both apply', async ($, on) => {
  world(on, { exitCode: 0, stdout: ' M src/a.py\n' })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  for (let i = 0; i < 3; i++) await $.agent.spawn({ prompt: `GOAL: ${i}`, subagentType: IMPLEMENTOR })
  const third = await ran($, IMPLEMENTOR)

  expect(third.context).toHaveLength(2)
  expect(third.context?.[0]).toMatch(/last one/)
  expect(third.context?.[1]).toMatch(/no test files/)
})

test('findings: a background reviewer is read from its own final turn, and the note rides the next main tool result', async ($, on) => {
  const w = world(on)
  editTools(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: review\n${BLOCK}`, subagentType: REVIEWER })
  await $.turn.complete({ agentId: 'agent-1', answer: 'working on it', durationMs: 1, isAborted: false, turnId: 't0', reason: 'answer' } as never)
  await $.turn.complete({ agentId: 'agent-1', answer: REVIEW, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  const next = await $.tool.call({ tool: 'Write', file_path: '/work/repo/FEATURE_FLOW.md', content: 'x' } as never)
  await $.agent.spawn({ prompt: `GOAL: fix\n${BLOCK}`, subagentType: IMPLEMENTOR })

  expect(next.context?.[0]).toMatch(/1 finding\(s\) \[minor\] that say a test can't fail/)
  expect(w.spawned[1]).toContain("REVIEWER'S BLOCKING FINDINGS:")
  expect(w.spawned[1]).toContain('test_ids_unique passes with the lock removed')
})

test('findings: a reviewer read from its turn is not read again from its tool result', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await $.agent.spawn({ prompt: `GOAL: review\n${BLOCK}`, subagentType: REVIEWER })
  await $.turn.complete({ agentId: 'agent-1', answer: REVIEW, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  w.agent.result = reviewed(REVIEW, 'agent-1')
  const out = await ran($, REVIEWER)

  expect(out.context).toHaveLength(1)
})

function editTools(on: On) {
  for (const tool of ['Edit', 'Write'] as const) on('tool.call', { tool }, async () => ({ result: { ok: true } }) as never)
}

test('edits: the main conversation editing a repo file during a run gets a note', async ($, on) => {
  world(on)
  editTools(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await $.tool.call({ tool: 'Edit', file_path: '/work/repo/src/etag.go', old_string: 'a', new_string: 'b' } as never)

  expect(out.context?.[0]).toMatch(/edited \/work\/repo\/src\/etag\.go itself/)
})

test('edits: the project file, the scratchpad and temp files are fine, and nothing is noted before the skill runs', async ($, on) => {
  world(on)
  editTools(on)
  const before = await $.tool.call({ tool: 'Write', file_path: '/work/repo/src/a.go', content: 'x' } as never)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const outs = await Promise.all(
    ['/work/repo/FEATURE_FLOW.md', '/tmp/claude-0/x/scratchpad/criteria.md', '/tmp/probe/race.py', '/root/.claude/notes.md'].map(
      file_path => $.tool.call({ tool: 'Write', file_path, content: 'x' } as never),
    ),
  )

  expect(before.context ?? []).toEqual([])
  for (const out of outs) expect(out.context ?? []).toEqual([])
})

test('checks: the exact text with different blank lines is not rewritten or logged', async ($, on) => {
  const w = world(on)
  withChecks(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const prompt = `GOAL: a\n${BLOCK}\nTRIGGERED CHECKS:\n${SHARED}\n\n\n${INVARIANTS}`
  await $.agent.spawn({ prompt, subagentType: IMPLEMENTOR })

  expect(w.spawned[0]).toBe(prompt)
  expect(w.logs.some(line => line.includes('exact words'))).toBe(false)
})

test('edits: a repo under /tmp is still the repo, and paths outside it are fine', async ($, on) => {
  const w = world(on)
  w.setRoot('/tmp/ff-eval-x/workspace')
  editTools(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const inside = await $.tool.call({ tool: 'Edit', file_path: '/tmp/ff-eval-x/workspace/tests/test_orders.py', old_string: 'a', new_string: 'b' } as never)
  const outside = await $.tool.call({ tool: 'Write', file_path: '/tmp/probe/race.py', content: 'x' } as never)
  const sibling = await $.tool.call({ tool: 'Write', file_path: '/tmp/ff-eval-x/workspace2/a.py', content: 'x' } as never)

  expect(inside.context?.[0]).toMatch(/edited \/tmp\/ff-eval-x\/workspace\/tests\/test_orders\.py itself/)
  expect(outside.context ?? []).toEqual([])
  expect(sibling.context ?? []).toEqual([])
})

test('edits: with no repo root, only the project file, scratchpad and .claude are exempt', async ($, on) => {
  const w = world(on)
  w.setRoot('')
  editTools(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const code = await $.tool.call({ tool: 'Edit', file_path: '/tmp/ws/src/a.py', old_string: 'a', new_string: 'b' } as never)
  const scratch = await $.tool.call({ tool: 'Write', file_path: '/tmp/claude-0/s/scratchpad/criteria.md', content: 'x' } as never)

  expect(code.context?.[0]).toMatch(/itself/)
  expect(scratch.context ?? []).toEqual([])
  expect(w.logs.filter(line => !line.includes('delivered a note'))).toEqual([])
})

test('checks: the orchestrator\'s own text after the checks is kept, and reordered exact checks are left alone', async ($, on) => {
  const w = world(on)
  withChecks(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const extra = 'Work tests first. Also property-test the matcher against the stdlib on 1000 random headers.'
  const reordered = `GOAL: a\n${BLOCK}\nTRIGGERED CHECKS:\n\n${INVARIANTS}\n\n${SHARED}\n\n${extra}`
  await $.agent.spawn({ prompt: reordered, subagentType: IMPLEMENTOR })
  const partial = `GOAL: b\n${BLOCK}\nTRIGGERED CHECKS:\n\n${SHARED}\n- Invariants: property test it.\n\n${extra}`
  await $.agent.spawn({ prompt: partial, subagentType: REVIEWER })

  expect(w.spawned[0]).toBe(reordered)
  expect(w.spawned[1]).toContain(extra)
  expect(w.spawned[1]).toContain(INVARIANTS)
  expect(w.spawned[1]).toContain('- Invariants: property test it.')
  expect(w.spawned[1].split(SHARED)).toHaveLength(2)
})

test('findings: "cannot see the bug" and "would pass with the bug" count as a test that can\'t fail', async ($, on) => {
  const w = world(on)
  w.agent.result = reviewed(
    [
      'FINDINGS:',
      '- [minor] `TestETagTrailersReachClient` checks only resp.Trailer, so it cannot see the duplicate header. It would pass with the bug above.',
      '- [minor] TestHead would still pass with the mutant applied.',
    ].join('\n'),
  )
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const out = await ran($, REVIEWER)

  expect(out.context?.[0]).toMatch(/2 finding\(s\) \[minor\] that say a test can't fail/)
})

test('notes: each delivered note is also logged, so a trace shows it', async ($, on) => {
  const w = world(on)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  for (let i = 0; i < 3; i++) await $.agent.spawn({ prompt: `GOAL: ${i}`, subagentType: IMPLEMENTOR })
  await ran($, IMPLEMENTOR)

  expect(w.logs.some(line => /delivered a note with the Agent result: .*second fix round/.test(line))).toBe(true)
})

test('findings: a handoff with the orchestrator\'s own FINDINGS TO FIX section gets no second copy', async ($, on) => {
  const w = world(on)
  w.agent.result = reviewed(REVIEW)
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await ran($, REVIEWER)
  const own = `GOAL: fix\n${BLOCK}\nFINDINGS TO FIX:\n1. [blocking] refund() races.`
  await $.agent.spawn({ prompt: own, subagentType: IMPLEMENTOR })

  expect(w.spawned[0]).toBe(own)
})
