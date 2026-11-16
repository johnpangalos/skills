// The limiter's pure parts: which sub-commands of a Bash call are heavy, what
// each weighs by default, the rewrite that routes each through the pool
// (heavy.pl), and the note added to the result. register.ts wires them to the
// tool.call hook; nothing here touches `$`.
import { segments, tokenize } from './shell'
import type { Segment } from './shell'

export type Heavy = {
  kind: string // what the waiting line and the note call it: `cargo test`
  key: string // the command, normalized: the pool records duration and peak memory per repo and key
  cores: number // cores it uses at full parallelism
  mem: number // peak memory in MB before any run is recorded
  minCores: number // the fewest cores worth starting with: below `cores` only when it takes a hint
  hint?: string // how to tell it the cores it got (heavy.pl's --hint)
  at: number // index into the segment's words where the wrapper goes
}

const base = (w: string) => w.slice(w.lastIndexOf('/') + 1)
const has = (words: readonly string[], ...flags: string[]) => words.some(w => flags.some(f => w === f || w.startsWith(`${f}=`)))

// Watch modes, servers, interactive runs: they never finish on their own, so they never take a slot.
const ENDLESS = ['--watch', '--watchAll', '--ui', '--serve']

type Weight = Omit<Heavy, 'key' | 'at'>

// A command's weight from its words (after env prefixes, `timeout` and package
// runners). `cores` is the machine's: what most of these use when left alone.
function weigh(words: readonly string[], cores: number): Weight | undefined {
  const tool = base(words[0] ?? '')
  const sub = words[1] ?? ''
  const rest = words.slice(1)
  if (tool === 'cargo') {
    const subs: Record<string, string> = { build: 'build', b: 'build', test: 'test', t: 'test', clippy: 'clippy', check: 'check', c: 'check', bench: 'bench', nextest: 'nextest' }
    const name = subs[sub]
    if (name === undefined) return undefined
    return { kind: `cargo ${name}`, cores, mem: 4096, minCores: 1, hint: 'env:CARGO_BUILD_JOBS' }
  }
  if (tool === 'go' && (sub === 'build' || sub === 'test' || sub === 'vet')) {
    return { kind: `go ${sub}`, cores, mem: 2048, minCores: 1, hint: 'after:1:-p=' }
  }
  if (tool === 'playwright' && sub === 'test') {
    if (has(rest, '--ui', '--debug', '--headed', '--list')) return undefined
    return { kind: 'playwright test', cores, mem: 4096, minCores: 1, hint: 'append:--workers=' }
  }
  if (tool === 'jest') {
    if (has(rest, '--watch', '--watchAll', '--listTests')) return undefined
    return { kind: 'jest', cores, mem: 3072, minCores: 1, hint: 'append:--maxWorkers=' }
  }
  if (tool === 'vitest') {
    // plain `vitest` watches outside CI
    if (!(sub === 'run' || has(rest, '--run'))) return undefined
    return { kind: 'vitest', cores, mem: 3072, minCores: 1, hint: 'append:--maxWorkers=' }
  }
  if (tool === 'tsc') {
    if (has(rest, '--watch', '-w', '--version', '-v', '--init')) return undefined
    return { kind: 'tsc', cores: 1, mem: 4096, minCores: 1 }
  }
  if (tool === 'tsgo') {
    if (has(rest, '--watch', '-w', '--version', '-v')) return undefined
    return { kind: 'tsgo', cores: Math.min(4, cores), mem: 6144, minCores: Math.min(4, cores) }
  }
  if ((tool === 'next' || tool === 'vite' || tool === 'nuxt' || tool === 'astro') && sub === 'build') {
    return { kind: `${tool} build`, cores: Math.min(4, cores), mem: 4096, minCores: Math.min(4, cores) }
  }
  if (tool === 'docker' && (sub === 'build' || (sub === 'buildx' && words[2] === 'build') || (sub === 'compose' && words[2] === 'build'))) {
    return { kind: 'docker build', cores: Math.min(2, cores), mem: 2048, minCores: Math.min(2, cores) }
  }
  return undefined
}

// Package-manager forms that run a tool from node_modules: `npx jest`,
// `pnpm exec vitest run`, `yarn playwright test`. The number of words before
// the tool, or undefined.
function runnerSkip(words: readonly string[]): number | undefined {
  const tool = base(words[0] ?? '')
  if (tool === 'npx' || tool === 'bunx') return 1
  if ((tool === 'pnpm' || tool === 'bun') && (words[1] === 'exec' || words[1] === 'x' || words[1] === 'dlx')) return 2
  if (tool === 'yarn' && (words[1] === 'exec' || words[1] === 'dlx')) return 2
  if (tool === 'yarn' || tool === 'pnpm') return 1 // `yarn jest`: a script or a binary, both pass extra arguments through
  return undefined
}

// Package scripts that usually build or test: their contents are unknown, so
// they weigh the whole machine and take no hint.
const HEAVY_SCRIPTS = new Set(['test', 'build', 'typecheck', 'type-check', 'check-types', 'e2e', 'test:e2e', 'test:unit', 'test:ci'])

function weighScript(words: readonly string[], cores: number): Weight | undefined {
  const tool = base(words[0] ?? '')
  if (tool !== 'yarn' && tool !== 'npm' && tool !== 'pnpm' && tool !== 'bun') return undefined
  const i = words[1] === 'run' || (tool === 'bun' && words[1] === 'run') ? 2 : 1
  if (tool === 'npm' && i === 1 && words[1] !== 'test') return undefined // npm <script> needs run, except test
  if (tool === 'bun' && i === 1 && words[1] !== 'test') return undefined // bare `bun x` runs a file
  const script = words[i] ?? ''
  if (!HEAVY_SCRIPTS.has(script)) return undefined
  if (has(words.slice(i + 1), ...ENDLESS)) return undefined
  return { kind: `${tool} ${script}`, cores, mem: 3072, minCores: cores }
}

// The heavy command a segment runs, or undefined.
export function heavyOf(seg: Segment, cores: number): Heavy | undefined {
  const words = seg.words.map(t => t.value)
  let i = 0
  const env: string[] = []
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]!)) env.push(words[i++]!)
  if (env.some(e => e === 'CLAUDE_HEAVY=0' || e.startsWith('CLAUDE_HEAVY_SLOT='))) return undefined
  const at = i
  // the check cache's wrapper: the limiter goes inside it, so a replayed pass takes no slot
  if (words[i] === 'bash' && base(words[i + 1] ?? '') === 'ffcc.sh') {
    const dash = words.indexOf('--', i + 2)
    if (dash < 0) return undefined
    const inner = heavyOfWords(words.slice(dash + 1), [], cores)
    return inner && { ...inner, at: dash + 1 }
  }
  // already limited
  if (words[i] === 'perl' && base(words[i + 1] ?? '') === 'heavy.pl') return undefined
  const found = heavyOfWords(words.slice(i), env, cores)
  return found && { ...found, at }
}

function heavyOfWords(words: readonly string[], env: readonly string[], cores: number): Omit<Heavy, 'at'> | undefined {
  let w = words
  if (w[0] === 'timeout') {
    let j = 1
    // its options, `-s KILL` and `-k 10` taking a value of their own
    while (w[j]?.startsWith('-')) j += /^(?:-[sk]|--signal|--kill-after)$/.test(w[j]!) ? 2 : 1
    w = w.slice(j + 1)
  }
  if (w.length === 0) return undefined
  if (has(w, ...ENDLESS)) return undefined
  const skip = runnerSkip(w)
  const weight = weighScript(w, cores) ?? (skip !== undefined ? weigh(w.slice(skip), cores) : undefined) ?? weigh(w, cores)
  if (weight === undefined) return undefined
  // a hint goes on the tool's own arguments: through a runner, the index moves; through a script, none
  const shift = skip !== undefined && weighScript(w, cores) === undefined ? skip + (words.length - w.length) : words.length - w.length
  let hint = weight.hint
  if (hint?.startsWith('after:')) {
    const [, n, flag] = hint.split(':')
    hint = `after:${Number(n) + shift}:${flag}`
  }
  const key = [...env, ...words].join(' ')
  return { ...weight, ...(hint === undefined ? {} : { hint }), key }
}

export type Setup = { script: string; pool: string; cores: number; mem: number }
export type Wrapped = { kind: string; key: string; cores: number; mem: number; minCores: number }
export type Plan = { command: string; wrapped: Wrapped[] }

const quote = (s: string) => (/^[A-Za-z0-9_./:=@%+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`)

// The wrapper's own words, up to and including the `--` before the command.
export function wrapperWords(setup: Setup, h: Omit<Heavy, 'at'>, notes?: string): string[] {
  return [
    'perl', setup.script, '--dir', setup.pool, '--kind', h.kind, '--key', h.key,
    '--cores', String(h.cores), '--mem', String(h.mem), '--min-cores', String(h.minCores),
    ...(h.hint === undefined ? [] : ['--hint', h.hint]),
    '--budget-cores', String(setup.cores), '--budget-mem', String(setup.mem),
    ...(notes === undefined ? [] : ['--notes', notes]),
    '--',
  ]
}

// Rewrites each heavy command in the call to wait for its slot. Undefined when
// there is none: the call runs as written.
export function planRewrite(command: string, setup: Setup, notes?: string): Plan | undefined {
  const tokens = tokenize(command)
  if (!tokens) return undefined
  const edits: { at: number; text: string }[] = []
  const wrapped: Wrapped[] = []
  for (const seg of segments(tokens)) {
    const h = heavyOf(seg, setup.cores)
    if (!h) continue
    const word = seg.words[h.at]
    if (!word) continue
    edits.push({ at: word.start, text: `${wrapperWords(setup, h, notes).map(quote).join(' ')} ` })
    wrapped.push({ kind: h.kind, key: h.key, cores: h.cores, mem: h.mem, minCores: h.minCores })
  }
  if (wrapped.length === 0) return undefined
  let out = command
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.at)
  return { command: out, wrapped }
}

export type Waited = { key: string; seconds: number; ahead: number; cores: number }

// The notes file heavy.pl writes: one line per command that waited.
export function parseNotes(text: string): Waited[] {
  const out: Waited[] = []
  for (const line of text.split('\n')) {
    const [kind, key = '', s = '', a = '', c = ''] = line.split('\t')
    if (kind === 'waited') out.push({ key, seconds: Number(s), ahead: Number(a), cores: Number(c) })
  }
  return out
}

const human = (s: number) => (s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)} min`)

// The note added to the call's result, or undefined.
export function noteFor(waits: readonly Waited[], plugin: string, totalCores: number, background: boolean): string | undefined {
  if (waits.length === 0) return undefined
  const parts = waits.map(w => {
    const ahead = w.ahead === 1 ? '1 heavy command' : `${w.ahead} heavy commands`
    const cores = w.cores < totalCores ? `, then ran with ${w.cores} of ${totalCores} cores` : ''
    return `\`${w.key}\` waited ${human(w.seconds)} for a machine-wide slot behind ${ahead} from other sessions${cores}`
  })
  const tip = background ? '' : ' A long wait counts against the Bash timeout: run heavy commands with run_in_background when other sessions are busy.'
  return `${plugin}: ${parts.join('; ')}.${tip}`
}

// The Bash timeout to give a call expected to wait `wait` seconds for its slot
// first: the call's own (or the 2-minute default) plus the wait, at most 10 minutes.
export function timeoutFor(current: number | undefined, wait: number): number | undefined {
  if (wait <= 0) return current
  return Math.min(600_000, (current ?? 120_000) + Math.ceil(wait) * 1000)
}
