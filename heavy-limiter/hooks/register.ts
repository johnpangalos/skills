import type { EngineInterface, Register } from 'claude-code'
import { noteFor, parseNotes, planRewrite, timeoutFor } from './heavy'
import type { Setup } from './heavy'

// heavy-limiter: one pool of cores and memory per machine, shared by every
// session, for the commands that size themselves to the whole machine (cargo,
// go test, Playwright, jest, vitest, tsc, builds). Each heavy command in a Bash
// call is rewritten to wait for room in the pool (hooks/heavy.pl); a call
// expected to wait gets that time added to its timeout, and one that waited
// says so in its result. CLAUDE_HEAVY=0 turns it off.
export const register: Register = on => {
  let setup: Promise<Setup | undefined> | undefined

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    setup ??= setUp($)
    const s = await setup
    if (s === undefined) return next(e)
    const notes = `${s.pool}/notes/${crypto.randomUUID()}`
    const plan = planRewrite(e.command, s, notes)
    if (plan === undefined) return next(e)
    let timeout = e.timeout
    if (e.run_in_background !== true) {
      const wait = await expectedWait($, s, plan.wrapped[0]!)
      timeout = timeoutFor(e.timeout, wait)
    }
    const ran = await next({ ...e, command: plan.command, ...(timeout === undefined ? {} : { timeout }) })
    if (e.run_in_background === true || ran.deny !== undefined) return ran
    let note: string | undefined
    try {
      if (await $.fs.exists(notes)) {
        note = noteFor(parseNotes(await $.fs.read(notes)), $.plugin.name, s.cores, false)
        await $.process.run(['rm', '-f', notes])
      }
    } catch {
      return ran
    }
    return note === undefined ? ran : { ...ran, context: [...(ran.context ?? []), note] }
  }).catch(($, e, next) => next(e))
}

// The pool's folder and the machine's budget, once per load. The folder is one
// per user in /tmp, where sandboxed commands may write; CLAUDE_HEAVY_DIR moves
// it. The budget is the machine less headroom for the sessions themselves:
// one core, and a fifth of memory (at least 4 GB). CLAUDE_HEAVY_CORES and
// CLAUDE_HEAVY_MEM_MB set it outright.
async function setUp($: EngineInterface): Promise<Setup | undefined> {
  try {
    if ((await $.env.get('CLAUDE_HEAVY')) === '0') return undefined
    const uid = (await $.process.run(['id', '-u'])).stdout.trim()
    const pool = (await $.env.get('CLAUDE_HEAVY_DIR')) || `/tmp/claude-heavy-${uid || 'user'}`
    const machine = await machineSize($)
    const cores = Number(await $.env.get('CLAUDE_HEAVY_CORES')) || Math.max(1, machine.cores - 1)
    const mem = Number(await $.env.get('CLAUDE_HEAVY_MEM_MB')) || Math.max(1024, Math.round(machine.mem - Math.max(4096, machine.mem * 0.2)))
    await $.process.run(['mkdir', '-p', `${pool}/p`, `${pool}/notes`])
    $.ui.log(`${$.plugin.name}: pool ${pool}, ${cores} cores and ${Math.round(mem / 1024)} GB for heavy commands.`)
    return { script: `${$.plugin.root}/hooks/heavy.pl`, pool, cores, mem }
  } catch (err) {
    $.ui.log(`${$.plugin.name}: off: ${String((err as Error)?.message ?? err)}`)
    return undefined
  }
}

// Cores and memory (MB): sysctl on macOS, nproc and /proc/meminfo on Linux.
async function machineSize($: EngineInterface): Promise<{ cores: number; mem: number }> {
  const mac = await $.process.run(['sysctl', '-n', 'hw.ncpu', 'hw.memsize']).catch(() => undefined)
  if (mac?.exitCode === 0) {
    const [c, m] = mac.stdout.trim().split(/\s+/).map(Number)
    if (c && m) return { cores: c, mem: m / 1048576 }
  }
  const n = await $.process.run(['nproc']).catch(() => undefined)
  const info = await $.fs.read('/proc/meminfo').catch(() => '')
  const kb = Number(/^MemTotal:\s+(\d+)/m.exec(info)?.[1])
  return { cores: Number(n?.stdout.trim()) || 2, mem: kb ? kb / 1024 : 8192 }
}

// Seconds the first heavy command would wait if it joined the pool now.
async function expectedWait($: EngineInterface, s: Setup, w: { kind: string; key: string; cores: number; mem: number; minCores: number }): Promise<number> {
  try {
    const argv = ['perl', s.script, '--dir', s.pool, '--status', '--kind', w.kind, '--key', w.key, '--cores', String(w.cores), '--mem', String(w.mem),
      '--min-cores', String(w.minCores), '--budget-cores', String(s.cores), '--budget-mem', String(s.mem)]
    const r = await $.process.run(argv, { timeoutMs: 5000 })
    return Number(r.stdout.split('\t')[1]) || 0
  } catch {
    return 0
  }
}
