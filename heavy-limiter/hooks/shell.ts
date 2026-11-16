// A shell command split into words and sub-commands, for the limiter to find
// the heavy commands in a Bash call. A copy of feature-flow-lite's parser
// (feature-flow-lite/hooks/check-cache.ts, from `Token` through `segments`),
// kept identical so both mods read a command the same way; heavy.test.sh
// checks that the copies still match.

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

