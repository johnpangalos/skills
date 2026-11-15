import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import { isProbe, mustFixes, panelPrompts, requestOf, timeline, withRequest, withRuledOn } from './extras'

const REQUEST = 'Add an ETag middleware.\n\n- It buffers the response.'

test('extras: the request is what follows the slash command', () => {
  expect(requestOf('/feature-flow-lite:feature-flow-lite Add an ETag middleware.')).toBe('Add an ETag middleware.')
  expect(requestOf('Fix the bug')).toBe('Fix the bug')
})

test('extras: a handoff missing the exact request gets it; one that has it (any spacing) does not', () => {
  expect(withRequest('GOAL: etag', REQUEST)).toContain(`REQUEST (the user's words, exactly as typed; added by the plugin):\n${REQUEST}`)
  expect(withRequest(`REQUEST:\nAdd an ETag   middleware.\n- It buffers the response.\nGOAL: x`, REQUEST)).toBeUndefined()
  expect(withRequest('GOAL: x', '')).toBeUndefined()
})

test('extras: must-fixes are read from a report and carried as RULED ON', () => {
  const report = ['MERGEABLE: no', 'FINDINGS:', '- [must-fix] HEAD drops Content-Length: `curl -I` shows none', '- [nit] naming', '* [Must-Fix] trailers leak'].join('\n')
  expect(mustFixes(report)).toEqual(['HEAD drops Content-Length: `curl -I` shows none', 'trailers leak'])
  const out = withRuledOn('GOAL: gate', mustFixes(report))
  expect(out).toContain('RULED ON: (added by the plugin)')
  expect(out).toContain('- trailers leak')
  expect(withRuledOn('GOAL: gate\nRULED ON:\n- x', ['y'])).toBeUndefined()
  expect(withRuledOn('GOAL: gate', [])).toBeUndefined()
})

test('extras: FOCUS: panel becomes three focused handoffs; other foci are left alone', () => {
  const prompts = panelPrompts('GOAL: gate\nFOCUS: panel\nREQUEST: x')
  expect(prompts).toHaveLength(3)
  expect(prompts?.map(p => p.match(/^FOCUS: (\w+)/m)?.[1])).toEqual(['request', 'edges', 'repo'])
  expect(prompts?.every(p => p.includes('REQUEST: x'))).toBe(true)
  expect(panelPrompts('FOCUS: all')).toBeUndefined()
})

test('extras: probe files and the timeline', () => {
  expect(isProbe('middleware/zz_gate_probe_test.go')).toBe(true)
  expect(isProbe('zz_redteam_x.py')).toBe(true)
  expect(isProbe('middleware/etag_test.go')).toBe(false)
  const t = timeline([
    { role: 'gatekeeper', startedAt: 180_000, endedAt: 300_000 },
    { role: 'implementor', startedAt: 60_000, endedAt: 120_000 },
  ])
  expect(t.split('\n')).toEqual([
    'timeline (minutes from the first subagent)',
    '  0.0 –   1.0    1.0 min  implementor',
    '  2.0 –   4.0    2.0 min  gatekeeper',
  ])
})

// The engine beneath: git, an in-memory file system, spawns, and the Agent and
// Edit tools, recording what reached them.
function world(on: On, env: Record<string, string>) {
  const spawned: { type: string; prompt: string }[] = []
  const agentCalls: { prompt: string; description: string; bg: unknown }[] = []
  const edits: string[] = []
  const runs: string[][] = []
  const files: Record<string, string> = {}
  let untracked = ''
  mock.env(on, env)
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('ui.log', () => ({ value: undefined }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('clock.now', () => ({ value: 1_000_000 }))
  const spawn = ($: unknown, e: { subagentType: string; prompt: string }) => {
    spawned.push({ type: e.subagentType, prompt: e.prompt })
    return { model: 'opus', agentId: `agent-${spawned.length}` }
  }
  on('agent.spawn', spawn as never)
  on('process.run', ($, e) => {
    const argv = [...e.argv]
    runs.push(argv)
    const out = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (argv.includes('--show-toplevel')) return out('/r\n')
    if (argv.includes('--git-common-dir')) return out('/r/.git\n')
    if (argv[0] === 'git' && argv.includes('HEAD')) return out('abc1234\n')
    if (argv[0] === 'git' && argv[1] === 'status') return out(untracked)
    return out('')
  })
  on('fs.exists', ($, e) => ({ value: e.path in files || e.path.endsWith('/hooks/ffcc.sh') }))
  on('fs.read', ($, e) => ({ value: files[e.path] ?? '' }))
  on('fs.write', ($, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  on('tool.call', { tool: 'Agent' }, ($, e) => {
    agentCalls.push({ prompt: e.prompt, description: e.description, bg: e.run_in_background })
    return { result: { status: 'completed', agentId: `seat-${agentCalls.length}`, content: [], prompt: '' }, text: `report ${agentCalls.length}` } as never
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)
  on('tool.call', { tool: 'Edit' }, ($, e) => {
    edits.push(e.file_path)
    return { result: {} } as never
  })
  return {
    spawned,
    agentCalls,
    edits,
    runs,
    files,
    setUntracked(s: string) {
      untracked = s
    },
  }
}

const start = async ($: Parameters<Parameters<typeof test>[1]>[0]) => {
  await $.prompt.submit({ text: `/feature-flow-lite:feature-flow-lite ${REQUEST}` } as never)
  await $.skill.prompt({ skill: 'feature-flow-lite:feature-flow-lite', text: 'SKILL BODY' } as never)
}

test('extras hook: off without FEATURE_FLOW_EXTRAS: no request added, no panel, edits allowed', async ($, on) => {
  const w = world(on, {})
  await start($)
  await $.agent.spawn({ prompt: 'GOAL: gate', subagentType: 'feature-flow-lite:gatekeeper' } as never)
  expect(w.spawned[0]?.prompt).toBe('GOAL: gate')
  await $.tool.call({ tool: 'Agent', subagent_type: 'feature-flow-lite:gatekeeper', description: 'Gate', prompt: 'FOCUS: panel' } as never)
  expect(w.agentCalls).toHaveLength(1)
  await $.tool.call({ tool: 'Edit', file_path: '/r/a.go', old_string: 'a', new_string: 'b' } as never)
  expect(w.edits).toEqual(['/r/a.go'])
})

test('extras hook: gatekeeper handoffs get the request and earlier must-fixes', async ($, on) => {
  const w = world(on, { FEATURE_FLOW_EXTRAS: '1' })
  await start($)
  await $.agent.spawn({ prompt: 'GOAL: gate', subagentType: 'feature-flow-lite:gatekeeper' } as never)
  expect(w.spawned[0]?.prompt).toContain(REQUEST)
  await $.turn.complete({ agentId: 'agent-1', answer: 'MERGEABLE: no\n- [must-fix] trailers leak', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await $.agent.spawn({ prompt: 'GOAL: gate again', subagentType: 'feature-flow-lite:gatekeeper' } as never)
  expect(w.spawned[1]?.prompt).toContain('RULED ON: (added by the plugin)')
  expect(w.spawned[1]?.prompt).toContain('- trailers leak')
  // an implementor handoff is left alone
  await $.agent.spawn({ prompt: 'GOAL: build', subagentType: 'feature-flow-lite:implementor' } as never)
  expect(w.spawned[2]?.prompt).toBe('GOAL: build')
})

// The test engine doesn't hand a mod's own $.agent.spawn the stub's agentId, so
// the seats' reports are checked in a real run; here, that all three focuses go
// out, the call's own seat in the foreground, and the result says so.
test('extras hook: FOCUS: panel sends out three gatekeepers, one per focus', async ($, on) => {
  const w = world(on, { FEATURE_FLOW_EXTRAS: '1' })
  await start($)
  const out = await $.tool.call({ tool: 'Agent', subagent_type: 'feature-flow-lite:gatekeeper', description: 'Gate', prompt: 'GOAL: gate\nFOCUS: panel' } as never)
  expect(w.spawned.map(s => s.prompt.match(/^FOCUS: (\w+)/m)?.[1])).toEqual(['edges', 'repo'])
  expect(w.spawned.every(s => s.prompt.includes(REQUEST))).toBe(true)
  expect(w.agentCalls.map(c => c.prompt.match(/^FOCUS: (\w+)/m)?.[1])).toEqual(['request'])
  expect(w.agentCalls[0]?.bg).toBe(false)
  const context = (out as { context?: readonly string[] }).context ?? []
  expect(context[0]).toContain('all three gatekeepers have finished')
  expect(context).toHaveLength(3)
  // FOCUS: all is a single call
  await $.tool.call({ tool: 'Agent', subagent_type: 'feature-flow-lite:gatekeeper', description: 'Final', prompt: 'FOCUS: all' } as never)
  expect(w.agentCalls).toHaveLength(2)
  expect(w.spawned).toHaveLength(2)
})

test('extras hook: the main conversation may not edit repo files; subagents and the project file may', async ($, on) => {
  const w = world(on, { FEATURE_FLOW_EXTRAS: '1' })
  await start($)
  const denied = await $.tool.call({ tool: 'Edit', file_path: '/r/middleware/etag.go', old_string: 'a', new_string: 'b' } as never)
  expect((denied as { deny?: string }).deny).toContain("doesn't edit the change itself")
  await $.tool.call({ tool: 'Edit', file_path: '/r/FEATURE_FLOW.md', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/tmp/scratch/criteria.md', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Edit', agentId: 'agent-9', file_path: '/r/middleware/etag.go', old_string: 'a', new_string: 'b' } as never)
  expect(w.edits).toEqual(['/r/FEATURE_FLOW.md', '/tmp/scratch/criteria.md', '/r/middleware/etag.go'])
})

test('extras hook: probe files are removed once no gatekeeper is running', async ($, on) => {
  const w = world(on, { FEATURE_FLOW_EXTRAS: '1' })
  await start($)
  await $.agent.spawn({ prompt: 'GOAL: gate', subagentType: 'feature-flow-lite:gatekeeper' } as never)
  await $.agent.spawn({ prompt: 'GOAL: gate 2', subagentType: 'feature-flow-lite:gatekeeper' } as never)
  await $.turn.start({ agentId: 'agent-1', text: '', turnId: 'a' } as never)
  await $.turn.start({ agentId: 'agent-2', text: '', turnId: 'b' } as never)
  w.setUntracked('?? middleware/zz_gate_probe_test.go\n?? middleware/etag.go\n')
  const done = (id: string) => ({ agentId: id, answer: 'MERGEABLE: yes', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' }) as never
  await $.turn.complete(done('agent-1'))
  expect(w.runs.some(r => r[0] === 'rm' && r.includes('-f'))).toBe(false) // agent-2 still running
  await $.turn.complete(done('agent-2'))
  expect(w.runs.filter(r => r[0] === 'rm').map(r => r.slice(3))).toEqual([['/r/middleware/zz_gate_probe_test.go']])
})

test('extras hook: an implementor finishing reruns ahead the checks the orchestrator ran, not the project file\'s other lines', async ($, on) => {
  const w = world(on, { FEATURE_FLOW_EXTRAS: '1', FEATURE_FLOW_CHECK_CACHE: '1' })
  w.files['/r/FEATURE_FLOW.md'] = '## Checks\n- `go test -race ./...` (CI: `make test`), `go vet ./...`\n'
  await start($)
  // a subagent's targeted run is not run ahead; the orchestrator's full run is
  await $.tool.call({ tool: 'Bash', agentId: 'agent-x', command: 'go test -race -run ETag ./middleware' } as never)
  await $.tool.call({ tool: 'Bash', command: 'go test -race -count=1 ./... | tail -3 && go vet ./...' } as never)
  await $.agent.spawn({ prompt: 'GOAL: build', subagentType: 'feature-flow-lite:implementor' } as never)
  const before = w.runs.length
  await $.turn.complete({ agentId: 'agent-1', answer: 'STATUS: pass', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await new Promise(r => setTimeout(r, 0))
  const ahead = w.runs.slice(before).filter(r => r[0] === 'bash' && r[1]?.endsWith('ffcc-queue.sh'))
  // queued for the low-priority worker (tree jobs prio 1), the first replacing older queued jobs
  expect(ahead.map(r => r.slice(2, 9))).toEqual([
    ['enqueue', '/r/.git/ff-check-cache', '1', '/r', 'go', 'go test -race ./...', 'mod'],
    ['enqueue', '/r/.git/ff-check-cache', '1', '/r', 'go', 'go vet ./...', 'mod'],
  ])
  expect(ahead[0]?.slice(9)).toEqual(['--replace', '--', 'go', 'test', '-p=1', '-race', '-count=1', './...'])
  expect(ahead[1]?.slice(9)).toEqual(['--', 'go', 'vet', '-p=1', './...'])
})
