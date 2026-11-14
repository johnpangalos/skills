// The check cache's pure parts: which sub-commands of a Bash call are checks,
// their normalized keys, the rewrite that routes each through the wrapper
// script, the wrapper itself, and the note added to the result. register.ts
// wires them to the tool.call hook; nothing here touches `$`.
//
// The key of a check is the normalized check, the directory it runs in, a tree
// fingerprint (HEAD plus the hash of every modified and untracked non-ignored
// file) and its toolchain inputs (tool versions, install state outside git).
// The wrapper takes the fingerprint when the check starts, so a `cd`, an edit
// earlier in the same call or another agent's edit is always seen.

// `subs`: the inner text of each `$( ... )` in the word, as offsets into the command.
export type Token = { kind: 'word' | 'op'; raw: string; value: string; start: number; end: number; dollar: boolean; subs?: Sub[] }
export type Sub = { start: number; end: number }

// The index just past the `)` that closes the `$(` at `i`, or -1.
function substEnd(command: string, i: number): number {
  let depth = 0
  for (let j = i; j < command.length; j++) {
    const c = command[j]
    if (c === "'") {
      const close = command.indexOf("'", j + 1)
      if (close < 0) return -1
      j = close
    } else if (c === '"') {
      let k = j + 1
      while (k < command.length && command[k] !== '"') k += command[k] === '\\' ? 2 : 1
      if (k >= command.length) return -1
      j = k
    } else if (c === '\\') {
      j++
    } else if (c === '(') {
      depth++
    } else if (c === ')') {
      depth--
      if (depth === 0) return j + 1
    }
  }
  return -1
}

// Splits a command into words and control operators, with offsets into the
// original text. A `$( ... )` stays inside its word (which is then never a
// cached check itself), with its inner text noted. Undefined when it holds
// something this parser won't reason about (backticks, heredocs, process
// substitution, groups, unbalanced quotes): such a command runs untouched.
export function tokenize(command: string): Token[] | undefined {
  const tokens: Token[] = []
  let i = 0
  let depth = 0
  const n = command.length
  while (i < n) {
    const c = command[i]
    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    if (c === '\\' && command[i + 1] === '\n') {
      i += 2
      continue
    }
    if (c === '#') {
      while (i < n && command[i] !== '\n') i++
      continue
    }
    if (c === '\n' || c === ';') {
      tokens.push({ kind: 'op', raw: c, value: ';', start: i, end: i + 1, dollar: false })
      i++
      continue
    }
    if (c === '&' || c === '|') {
      const two = command.slice(i, i + 2)
      if (two === '&&' || two === '||' || two === '|&') {
        tokens.push({ kind: 'op', raw: two, value: two, start: i, end: i + 2, dollar: false })
        i += 2
        continue
      }
      if (c === '&' && command[i + 1] === '>') {
        // &>file: a redirection word, read below
      } else {
        tokens.push({ kind: 'op', raw: c, value: c, start: i, end: i + 1, dollar: false })
        i++
        continue
      }
    }
    // A subshell group `( ... )` at a command's start splits commands like `;`
    // does: each check inside still runs through the wrapper, which reads the
    // directory at run time, so a `cd` inside the group is seen.
    if (c === '(') {
      const prev = tokens[tokens.length - 1]
      if (prev !== undefined && prev.kind !== 'op') return undefined // `f(`, `=(`: not a group
      depth++
      tokens.push({ kind: 'op', raw: c, value: '(', start: i, end: i + 1, dollar: false })
      i++
      continue
    }
    if (c === ')') {
      if (depth === 0) return undefined
      depth--
      tokens.push({ kind: 'op', raw: c, value: ')', start: i, end: i + 1, dollar: false })
      i++
      continue
    }
    if (c === '`') return undefined
    // a word, which may mix quoted and unquoted parts
    const start = i
    let value = ''
    let dollar = false
    const subs: Sub[] = []
    while (i < n) {
      const ch = command[i]
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === ';' || ch === '(' || ch === ')' || ch === '`') break
      if (ch === '|') break
      if (ch === '&' && !(command[i + 1] === '>' || (i > start && /[<>]$/.test(command.slice(start, i))))) break
      if (ch === '<' && (command[i + 1] === '<' || command[i + 1] === '(')) return undefined
      if (ch === '>' && command[i + 1] === '(') return undefined
      if (ch === "'") {
        const close = command.indexOf("'", i + 1)
        if (close < 0) return undefined
        value += command.slice(i + 1, close)
        i = close + 1
        continue
      }
      if (ch === '"') {
        let j = i + 1
        while (j < n && command[j] !== '"') {
          if (command[j] === '\\') j++
          else if (command[j] === '`') return undefined
          else if (command[j] === '$') {
            dollar = true
            if (command[j + 1] === '(') {
              const end = substEnd(command, j + 1)
              if (end < 0) return undefined
              subs.push({ start: j + 2, end: end - 1 })
              j = end
              continue
            }
          }
          j++
        }
        if (j >= n) return undefined
        value += command.slice(i + 1, j).replace(/\\(["\\$`])/g, '$1')
        i = j + 1
        continue
      }
      if (ch === '\\') {
        value += command[i + 1] ?? ''
        i += 2
        continue
      }
      if (ch === '$') {
        dollar = true
        if (command[i + 1] === '(') {
          const end = substEnd(command, i + 1)
          if (end < 0) return undefined
          subs.push({ start: i + 2, end: end - 1 })
          value += command.slice(i, end)
          i = end
          continue
        }
      }
      value += ch
      i++
    }
    const raw = command.slice(start, i)
    if (raw === '{' || raw === '}') return undefined
    tokens.push({ kind: 'word', raw, value, start, end: i, dollar, ...(subs.length ? { subs } : {}) })
  }
  return depth === 0 ? tokens : undefined
}

const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function', 'select', '[[', ']]', '!'])

// A redirection word: 2>&1, >/dev/null, >>log, &>out, < in, or a bare operator
// whose target is the next word.
const REDIRECT = /^(?:\d*|&)(?:>>?|<|>&|<&)/
const isRedirect = (t: Token) => t.kind === 'word' && !t.raw.startsWith("'") && !t.raw.startsWith('"') && REDIRECT.test(t.raw)
const redirectNeedsTarget = (t: Token) => /^(?:\d*|&)(?:>>?|<|>&|<&)$/.test(t.raw)

export type Segment = {
  words: Token[] // the command's words, redirections removed
  redirects: Token[][] // each redirection with its target
  before: string | undefined // the operator before it (undefined for the first)
  after: string | undefined // the operator after it
}

export function segments(tokens: Token[]): Segment[] {
  const out: Segment[] = []
  let current: Segment = { words: [], redirects: [], before: undefined, after: undefined }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.kind === 'op') {
      current.after = t.value
      out.push(current)
      current = { words: [], redirects: [], before: t.value, after: undefined }
      continue
    }
    if (isRedirect(t)) {
      const pair = [t]
      if (redirectNeedsTarget(t) && tokens[i + 1]?.kind === 'word') pair.push(tokens[++i]!)
      current.redirects.push(pair)
      continue
    }
    current.words.push(t)
  }
  out.push(current)
  return out.filter(s => s.words.length > 0 || s.redirects.length > 0)
}

export type Family = 'go' | 'node' | 'python' | 'rust' | 'other'

export type Check = {
  key: string // the normalized check
  family: Family
  first: number // index into words of the check's first word (after prefixes)
  envPrefix: string[] // VAR=value words, part of the key
}

// Flags that would make a check write, watch or update: such a call never goes
// through the cache.
const WRITES = /^(?:--fix(?:=.*)?|--write|-w|-u|--updateSnapshot|--update-snapshots?|--snapshot-update|--watch(?:All)?|--fix-type=.*)$/

// Flags that don't change a check's result or output: dropped from the key.
function normalizeArgs(family: Family, tool: string, args: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (family === 'go' && tool === 'test') {
      if (/^-?-count=\d+$/.test(a) || /^-?-timeout=\S+$/.test(a)) continue
      if ((a === '-count' || a === '-timeout' || a === '--count' || a === '--timeout') && i + 1 < args.length) {
        i++
        continue
      }
    }
    if (tool === 'jest' && (a === '--no-cache' || a === '--ci')) continue
    if (tool === 'pytest' && a === '--cache-clear') continue
    if (tool === 'pytest' && a === '-p' && args[i + 1] === 'no:cacheprovider') {
      i++
      continue
    }
    if (tool === 'mypy' && a === '--no-incremental') continue
    out.push(a === './' ? '.' : a)
  }
  return out
}

const NODE_SCRIPTS = new Set(['jest', 'eslint', 'check-types', 'tsc', 'tsgo', 'test', 'lint', 'typecheck', 'type-check', 'vitest'])
const basename = (w: string) => w.slice(w.lastIndexOf('/') + 1)

// Recognizes a built-in check from its words (after prefixes). Returns the
// family and the key's leading words, or undefined.
function builtinCheck(words: string[]): { family: Family; tool: string; lead: string[]; args: string[] } | undefined {
  let w = words
  const lead: string[] = []
  if (w.length === 0) return undefined
  // runners kept in the key
  if ((w[0] === 'uv' || w[0] === 'poetry' || w[0] === 'pipenv') && w[1] === 'run') {
    lead.push(w[0], 'run')
    w = w.slice(2)
  } else if (/^python3?(?:\.\d+)?$/.test(basename(w[0] ?? '')) && w[1] === '-m') {
    lead.push(w[0]!, '-m')
    w = w.slice(2)
  }
  const first = w[0] ?? ''
  const tool = basename(first)
  const sub = w[1]
  const rest = w.slice(1)
  if (lead.length === 0 && tool === 'go' && (sub === 'test' || sub === 'vet')) return { family: 'go', tool: sub, lead: [first, sub], args: w.slice(2) }
  if (tool === 'gofmt' && rest.some(a => a === '-l' || a === '-d')) return { family: 'go', tool, lead: [first], args: rest }
  if (tool === 'golangci-lint' && sub === 'run') return { family: 'go', tool, lead: [first, sub], args: w.slice(2) }
  if (tool === 'staticcheck') return { family: 'go', tool, lead: [first], args: rest }
  if (['pytest', 'py.test', 'mypy', 'pyright', 'flake8'].includes(tool)) return { family: 'python', tool: tool === 'py.test' ? 'pytest' : tool, lead: [...lead, first], args: rest }
  if (tool === 'ruff' && sub === 'check') return { family: 'python', tool, lead: [...lead, first, sub], args: w.slice(2) }
  if ((tool === 'ruff' && sub === 'format') || tool === 'black') {
    if (!rest.includes('--check')) return undefined
    return { family: 'python', tool, lead: [...lead, ...w.slice(0, tool === 'ruff' ? 2 : 1)], args: w.slice(tool === 'ruff' ? 2 : 1) }
  }
  if (lead.length) return undefined
  if (tool === 'cargo' && (sub === 'test' || sub === 'clippy' || sub === 'check')) return { family: 'rust', tool: sub, lead: [first, sub], args: w.slice(2) }
  if (tool === 'cargo' && sub === 'fmt' && rest.includes('--check')) return { family: 'rust', tool: 'fmt', lead: [first, sub], args: w.slice(2) }
  if (tool === 'yarn' || tool === 'pnpm' || tool === 'npm' || tool === 'npx') {
    let i = 1
    if ((tool === 'npm' || tool === 'yarn' || tool === 'pnpm') && w[1] === 'run') i = 2
    if (tool === 'npm' && i === 1 && w[1] !== 'test') return undefined // npm <script> needs run, except test
    const script = w[i]
    if (!script || !NODE_SCRIPTS.has(script)) return undefined
    if (script === 'vitest' && !w.slice(i + 1).some(a => a === 'run' || a === '--run')) return undefined
    if (script === 'tsc' && !w.slice(i + 1).some(a => a === '--noEmit' || a === '--no-emit')) return undefined
    return { family: 'node', tool: script, lead: [tool, script], args: w.slice(i + 1) }
  }
  if (tool === 'jest' || tool === 'eslint' || tool === 'tsgo') return { family: 'node', tool, lead: [first], args: rest }
  if (tool === 'tsc' && rest.some(a => a === '--noEmit' || a === '--no-emit')) return { family: 'node', tool, lead: [first], args: rest }
  if (tool === 'vitest' && rest.some(a => a === 'run' || a === '--run')) return { family: 'node', tool, lead: [first], args: rest }
  return undefined
}

const familyOf = (word: string): Family => {
  const tool = basename(word)
  if (/^(?:go|gofmt|golangci-lint|staticcheck)$/.test(tool)) return 'go'
  if (/^(?:yarn|npm|npx|pnpm|node|jest|eslint|tsc|tsgo|vitest)$/.test(tool)) return 'node'
  if (/^(?:python3?|pytest|mypy|ruff|uv|poetry|black)$/.test(tool)) return 'python'
  if (/^(?:cargo|rustc)$/.test(tool)) return 'rust'
  return 'other'
}

// The check a segment runs, or undefined. `projectChecks` are the project
// file's Checks, each as its words: a segment that starts with one is a check.
export function checkOf(segment: Segment, projectChecks: readonly string[][] = []): Check | undefined {
  const words = segment.words
  let i = 0
  const envPrefix: string[] = []
  for (let t = words[i]; t !== undefined && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t.raw); t = words[++i]) {
    if (t.dollar) return undefined
    envPrefix.push(t.value)
  }
  if (envPrefix.some(e => e.startsWith('FF_NO_CACHE='))) return undefined
  if (words[i]?.value === 'timeout') {
    i++
    while (words[i]?.value.startsWith('-')) i++
    i++ // the duration
  }
  const rest = words.slice(i)
  if (rest.length === 0 || rest.some(t => t.dollar)) return undefined
  const values = rest.map(t => t.value)
  const head = values[0] ?? ''
  if (KEYWORDS.has(head)) return undefined
  if (values.some(v => WRITES.test(v))) return undefined
  const builtin = builtinCheck(values)
  if (builtin) {
    const key = [...envPrefix, ...builtin.lead, ...normalizeArgs(builtin.family, builtin.tool, builtin.args)].join(' ')
    return { key, family: builtin.family, first: i, envPrefix }
  }
  for (const check of projectChecks) {
    if (check.length > 0 && check.every((w, k) => values[k] === w)) {
      return { key: [...envPrefix, ...values].join(' '), family: familyOf(head), first: i, envPrefix }
    }
  }
  return undefined
}

// Commands that can come before a check in the same call without changing
// what it checks. Anything else (an edit, an install, a script) stops the
// checks after it from being cached.
const READ_ONLY = new Set(['cd', 'echo', 'printf', 'ls', 'pwd', 'cat', 'head', 'tail', 'wc', 'grep', 'rg', 'which', 'true', 'set', 'date', 'sleep', 'test', '[', ':'])
const READ_ONLY_GIT = new Set(['status', 'diff', 'log', 'show', 'rev-parse', 'branch', 'ls-files'])

function writesFile(segment: Segment): boolean {
  return segment.redirects.some(pair => {
    const op = pair[0]!.raw
    if (!/>/.test(op) || /^\d*>&\d+$/.test(op)) return false
    const target = pair[1] !== undefined ? pair[1].value : op.replace(/^(?:\d*|&)>>?/, '')
    return target !== '/dev/null' && target !== '/dev/stderr' && target !== '/dev/stdout'
  })
}

function readOnly(segment: Segment): boolean {
  if (writesFile(segment)) return false
  const words = segment.words.map(t => t.value)
  if (words.length === 0) return true
  if (words[0] === 'git') return READ_ONLY_GIT.has(words[1] ?? '')
  if (words[0] === 'sed') return !words.some(w => w === '-i' || w.startsWith('-i') || w === '--in-place')
  return READ_ONLY.has(words[0] ?? '')
}

export type Wrapped = { key: string; family: Family; words: string[] }
export type Plan = { command: string; wrapped: Wrapped[] }

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

// Rewrites each cacheable check in the command to run through the wrapper.
// Undefined when nothing in it is cached: the call runs as written.
export function planRewrite(
  command: string,
  opts: { script: string; cacheDir: string; notes: string; projectChecks?: readonly string[][] },
): Plan | undefined {
  const tokens = tokenize(command)
  if (!tokens || tokens.some(t => t.kind === 'op' && t.value === '&')) return undefined
  const segs = segments(tokens)
  const edits: { start: number; end: number; text: string }[] = []
  const wrapped: Wrapped[] = []
  let clean = true // nothing before this segment can have written
  // a `$( check )` inside a word: wrap the check inside the substitution
  const wrapInner = (sub: Sub) => {
    const inner = tokenize(command.slice(sub.start, sub.end))
    const innerSegs = inner && segments(inner)
    if (!innerSegs || innerSegs.length !== 1 || !innerSegs[0]) return
    const check = checkOf(innerSegs[0], opts.projectChecks)
    if (!check) return
    const words = innerSegs[0].words.slice(check.first)
    if (words.length === 0) return
    const at = sub.start + words[0]!.start
    const head = ['bash', opts.script, opts.cacheDir, opts.notes, check.family, check.key].map(quote).join(' ')
    edits.push({ start: at, end: at, text: `${head} -- ` })
    wrapped.push({ key: check.key, family: check.family, words: words.map(t => t.value) })
  }
  for (const seg of segs) {
    if (clean) for (const t of [...seg.words, ...seg.redirects.flat()]) for (const sub of t.subs ?? []) wrapInner(sub)
    const check = clean && seg.before !== '|' && seg.before !== '|&' ? checkOf(seg, opts.projectChecks) : undefined
    if (check) {
      const words = seg.words.slice(check.first)
      // a redirection between the check's words would be moved: leave the segment alone
      const span = { start: words[0]!.start, end: words[words.length - 1]!.end }
      const inside = seg.redirects.some(pair => pair[0]!.start > span.start && pair[0]!.start < span.end)
      if (!inside) {
        const head = ['bash', opts.script, opts.cacheDir, opts.notes, check.family, check.key].map(quote).join(' ')
        edits.push({ start: span.start, end: span.start, text: `${head} -- ` })
        wrapped.push({ key: check.key, family: check.family, words: words.map(t => t.value) })
        continue
      }
    }
    if (!check && !readOnly(seg)) clean = false
    if (check) clean = clean && !writesFile(seg)
  }
  if (wrapped.length === 0) return undefined
  let out = command
  for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  return { command: out, wrapped }
}

// The project file's Checks: every `inline code` span in its Checks section,
// split into its sub-commands, each as words.
export function projectChecks(markdown: string): string[][] {
  const lines = markdown.split('\n')
  const start = lines.findIndex(l => /^#{1,6}\s.*\bchecks?\b/i.test(l))
  if (start < 0) return []
  const section: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break
    section.push(line)
  }
  const out: string[][] = []
  // a Run it line is how to start the app, and `<module>` or `...` mark a template, not a command
  // text in brackets is detail (what CI runs underneath), not another check to run
  const runnable = section
    .filter(line => !/^\s*[-*]?\s*\**run it\b/i.test(line))
    .map(line => line.replace(/\([^()]*\)/g, ''))
    .join('\n')
  for (const [, code] of runnable.matchAll(/`([^`\n]+)`/g)) {
    if (/<[^>\s]+>|(?:^|[\s(;,])\.\.\.|…/.test(code ?? '')) continue
    const tokens = tokenize(code ?? '')
    if (!tokens) continue
    for (const seg of segments(tokens)) {
      let words = seg.words.map(t => t.value)
      while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0] ?? '')) words = words.slice(1)
      if (words[0] === 'cd' || words.length === 0 || words.some(w => WRITES.test(w))) continue
      if (['yarn', 'npm', 'pnpm'].includes(words[0] ?? '') && ['install', 'add', 'ci'].includes(words[1] ?? '')) continue
      out.push(words)
    }
  }
  return out
}

export type NoteLine =
  | { kind: 'hit'; key: string; tree: string; head: string; changed: number; seconds: number; age: number; waited: number }
  | { kind: 'pass'; key: string; tree: string; seconds: number }
  | { kind: 'fail'; key: string; status: number; base: string; baseStatus: number | undefined }

// One line per event, tab-separated, as the wrapper writes them.
export function parseNotes(text: string): NoteLine[] {
  const out: NoteLine[] = []
  for (const line of text.split('\n')) {
    const f = line.split('\t')
    const [kind, key = '', a = '', b = '', c = '', d = '', e = '', g = ''] = f
    if (kind === 'hit' && f.length >= 8) {
      out.push({ kind: 'hit', key, tree: a, head: b, changed: Number(c), seconds: Number(d), age: Number(e), waited: Number(g) })
    } else if (kind === 'pass' && f.length >= 4) {
      out.push({ kind: 'pass', key, tree: a, seconds: Number(b) })
    } else if (kind === 'fail' && f.length >= 5) {
      out.push({ kind: 'fail', key, status: Number(a), base: b, baseStatus: c === '' ? undefined : Number(c) })
    }
  }
  return out
}

const ago = (s: number) => (s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}m`)

// The one-line note added to the call's result, or undefined.
export function noteFor(lines: readonly NoteLine[], plugin: string): string | undefined {
  const parts: string[] = []
  for (const l of lines) {
    if (l.kind === 'hit') {
      const files = l.changed === 1 ? '1 changed file' : `${l.changed} changed files`
      const waited = l.waited > 0 ? `waited ${ago(l.waited)} for another agent running the same check, then ` : ''
      parts.push(
        `${waited}replayed \`${l.key}\` from a passing run ${ago(l.age)} ago on the same tree ` +
          `(fingerprint ${l.tree}: HEAD ${l.head} + ${files}, same toolchain), saving ~${ago(l.seconds)}`,
      )
    } else if (l.kind === 'fail' && l.baseStatus !== undefined) {
      parts.push(
        l.baseStatus === 0
          ? `\`${l.key}\` failed (exit ${l.status}); it passed at the base commit ${l.base}, so this change broke it`
          : `\`${l.key}\` failed (exit ${l.status}); it failed at the base commit ${l.base} too (exit ${l.baseStatus}), so the failure is pre-existing`,
      )
    }
  }
  return parts.length ? `${plugin} check cache: ${parts.join('; ')}.` : undefined
}
