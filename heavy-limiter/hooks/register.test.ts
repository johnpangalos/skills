import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

type Ran = { argv: string[] }

// What sits beneath the mod: a Mac with 10 cores and 32 GB, a pool whose
// status says `wait` seconds, Bash that records the command it was given, and
// a notes file when `notes` is set.
function world(on: On, opts: { wait?: number; notes?: string; env?: Record<string, string> } = {}) {
  const runs: Ran[] = []
  const bash: { command: string; timeout?: number }[] = []
  const files: Record<string, string> = {}
  on('env.get', ($, e) => ({ value: opts.env?.[e.name] }))
  on('process.run', ($, e) => {
    runs.push({ argv: [...e.argv] })
    const out = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv[0] === 'id') return out('501\n')
    if (e.argv[0] === 'sysctl') return out('10\n34359738368\n')
    if (e.argv.includes('--status')) return out(`1\t${opts.wait ?? 0}\n`)
    return out('')
  })
  on('ui.log', () => ({ value: undefined }))
  on('fs.exists', ($, e) => ({ value: e.path in files }))
  on('fs.read', ($, e) => ({ value: files[e.path] }) as never)
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    bash.push({ command: e.command, ...(e.timeout === undefined ? {} : { timeout: e.timeout }) })
    const notes = /--notes ([^ ]+)/.exec(e.command)?.[1]
    if (notes !== undefined && opts.notes !== undefined) files[notes] = opts.notes
    return { result: { stdout: 'ok', stderr: '', interrupted: false }, text: 'ok' } as never
  })
  return { runs, bash }
}

test('a heavy command is rewritten to wait for its slot, with the machine less headroom as the budget', async ($, on) => {
  const w = world(on)
  await $.tool.call({ tool: 'Bash', command: 'cargo test' })
  const command = w.bash[0]!.command
  expect(command).toContain('heavy.pl --dir /tmp/claude-heavy-501 ')
  expect(command).toContain('--budget-cores 9 --budget-mem 26214 ')
  expect(command.endsWith(' -- cargo test')).toBe(true)
  expect(w.bash[0]!.timeout).toBe(undefined)
})

test('other commands pass untouched, and nothing asks the pool', async ($, on) => {
  const w = world(on)
  await $.tool.call({ tool: 'Bash', command: 'git status && ls' })
  expect(w.bash[0]!.command).toBe('git status && ls')
  expect(w.runs.some(r => r.argv.includes('--status'))).toBe(false)
})

test('an expected wait is added to the timeout', async ($, on) => {
  const w = world(on, { wait: 90 })
  await $.tool.call({ tool: 'Bash', command: 'npx playwright test' })
  expect(w.bash[0]!.timeout).toBe(210_000)
})

test('a background call keeps its timeout and is not asked about the wait', async ($, on) => {
  const w = world(on, { wait: 90 })
  await $.tool.call({ tool: 'Bash', command: 'cargo build', run_in_background: true } as never)
  expect(w.bash[0]!.timeout).toBe(undefined)
  expect(w.runs.some(r => r.argv.includes('--status'))).toBe(false)
})

test('a call that waited says so in its result', async ($, on) => {
  world(on, { notes: 'waited\tcargo test\t75\t1\t3\n' })
  const ran = await $.tool.call({ tool: 'Bash', command: 'cargo test' })
  expect(ran.context?.join('\n')).toContain('`cargo test` waited 75s for a machine-wide slot behind 1 heavy command from other sessions, then ran with 3 of 9 cores')
})

test('CLAUDE_HEAVY=0 turns it off; CLAUDE_HEAVY_DIR and the budget variables are honored', async ($, on) => {
  const off = world(on, { env: { CLAUDE_HEAVY: '0' } })
  await $.tool.call({ tool: 'Bash', command: 'cargo test' })
  expect(off.bash[0]!.command).toBe('cargo test')
})

test('the pool folder and budget can be set', async ($, on) => {
  const w = world(on, { env: { CLAUDE_HEAVY_DIR: '/shared/pool', CLAUDE_HEAVY_CORES: '4', CLAUDE_HEAVY_MEM_MB: '8000' } })
  await $.tool.call({ tool: 'Bash', command: 'go test ./...' })
  expect(w.bash[0]!.command).toContain('--dir /shared/pool ')
  expect(w.bash[0]!.command).toContain('--budget-cores 4 --budget-mem 8000 ')
})
