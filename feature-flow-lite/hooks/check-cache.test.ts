import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import { checkOf, noteFor, parseNotes, planRewrite, projectChecks, segments, tokenize } from './check-cache'

const OPTS = { script: '/p/hooks/ffcc.sh', cacheDir: '/r/.git/ff-check-cache', notes: '/r/.git/ff-check-cache/notes/n1' }
const HEAD = `'bash' '/p/hooks/ffcc.sh' '/r/.git/ff-check-cache' '/r/.git/ff-check-cache/notes/n1'`

const keyOf = (command: string, project: string[][] = []) => {
  const tokens = tokenize(command)
  if (!tokens) return undefined
  const [seg] = segments(tokens)
  return seg && checkOf(seg, project)?.key
}

test('keys: flags that do not change the result are dropped, ones that do are kept', () => {
  expect(keyOf('go test -race -count=1 ./...')).toBe('go test -race ./...')
  expect(keyOf('go test -count 1 -timeout 300s -race ./...')).toBe('go test -race ./...')
  expect(keyOf('go test -v ./...')).toBe('go test -v ./...')
  expect(keyOf('gofmt -l ./')).toBe('gofmt -l .')
  expect(keyOf('yarn jest --no-cache packages/x')).toBe('yarn jest packages/x')
  expect(keyOf('yarn run eslint .')).toBe('yarn eslint .')
  expect(keyOf('CI=1 yarn check-types')).toBe('CI=1 yarn check-types')
  expect(keyOf('timeout 600 go vet ./...')).toBe('go vet ./...')
  expect(keyOf('uv run pytest -p no:cacheprovider tests')).toBe('uv run pytest tests')
  expect(keyOf('cargo clippy --all-targets')).toBe('cargo clippy --all-targets')
})

test('keys: commands that write, watch or are not checks are never cached', () => {
  for (const command of [
    'gofmt -w .',
    'gofmt .',
    'golangci-lint run --fix',
    'ruff check --fix .',
    'ruff format .',
    'cargo fmt',
    'yarn eslint --fix src',
    'yarn jest -u',
    'yarn jest --updateSnapshot',
    'yarn install',
    'npm install',
    'vitest',
    'tsc -p .',
    'go build ./...',
    'go test $PKGS',
    'FF_NO_CACHE=1 go test ./...',
    'make test',
  ]) {
    expect([command, keyOf(command)]).toEqual([command, undefined])
  }
})

test("keys: the project file's Checks count as checks", () => {
  const project = projectChecks(
    ['# Project', '## Checks', '- `make test && make lint`', '- `yarn install` then `yarn eslint .`', '## Conventions', '- `make docs`'].join('\n'),
  )
  expect(project).toEqual([
    ['make', 'test'],
    ['make', 'lint'],
    ['yarn', 'eslint', '.'],
  ])
  expect(keyOf('make test', project)).toBe('make test')
  expect(keyOf('make docs', project)).toBeUndefined()
})

test('rewrite: each check in a compound command goes through the wrapper; pipes and redirections stay', () => {
  const plan = planRewrite('cd pkg && go test -race -count=1 ./... 2>&1 | tail -20 && go vet ./...', OPTS)
  expect(plan?.wrapped).toEqual([
    { key: 'go test -race ./...', family: 'go' },
    { key: 'go vet ./...', family: 'go' },
  ])
  expect(plan?.command).toBe(
    `cd pkg && ${HEAD} 'go' 'go test -race ./...' -- go test -race -count=1 ./... 2>&1 | tail -20 && ${HEAD} 'go' 'go vet ./...' -- go vet ./...`,
  )
})

test('rewrite: prefixes stay outside the wrapper, quotes survive', () => {
  const plan = planRewrite(`CI=1 timeout 900 yarn jest -t 'a b' packages/x; echo done`, OPTS)
  expect(plan?.command).toBe(`CI=1 timeout 900 ${HEAD} 'node' 'CI=1 yarn jest -t a b packages/x' -- yarn jest -t 'a b' packages/x; echo done`)
  const env = planRewrite('CI=1 yarn eslint .', OPTS)
  expect(env?.command).toBe(`CI=1 ${HEAD} 'node' 'CI=1 yarn eslint .' -- yarn eslint .`)
})

test('rewrite: a call that edits or installs before its checks is not cached after that point', () => {
  expect(planRewrite(`sed -i 's/a/b/' x.go && go test ./...`, OPTS)).toBeUndefined()
  expect(planRewrite('echo x > f.go && go test ./...', OPTS)).toBeUndefined()
  expect(planRewrite('yarn install && yarn jest', OPTS)).toBeUndefined()
  expect(planRewrite('git stash && go test ./... ; git stash pop', OPTS)).toBeUndefined()
  // a check before the edit is still cached; the one after it is not
  const plan = planRewrite('go vet ./... && gofmt -w . && go test ./...', OPTS)
  expect(plan?.wrapped.map(w => w.key)).toEqual(['go vet ./...'])
  // read-only commands before a check are fine
  expect(planRewrite('git status --short && ls && go test ./... > /dev/null', OPTS)?.wrapped).toHaveLength(1)
})

test('rewrite: shapes it does not reason about run untouched', () => {
  for (const command of [
    'go test $(go list ./...)',
    'go test `go list ./...`',
    '(cd pkg && go test ./...)',
    'go test ./... &',
    'cat <<EOF | go test\nx\nEOF',
    'for p in a b; do go test ./$p; done',
    'echo "unterminated',
    'cat list | go test ./...',
    'go test 2>&1 ./...',
  ]) {
    expect([command, planRewrite(command, OPTS)?.command]).toEqual([command, undefined])
  }
})

test('notes: a replay names the check, the fingerprint and the time saved; a failure says whether it is pre-existing', () => {
  const lines = parseNotes(
    [
      'hit\tgo test -race ./...\t3fa2c1d0e9b8a7f6\t1a2b3c4\t3\t41.2\t130\t0.0',
      'pass\tgo vet ./...\tabc\t2.0',
      'fail\tyarn jest\t1\t1a2b3c4\t1',
      'fail\tyarn eslint .\t1\t1a2b3c4\t0',
      'fail\tyarn tsc\t1\t1a2b3c4\t',
      'garbage',
    ].join('\n'),
  )
  expect(lines).toHaveLength(5)
  const note = noteFor(lines, 'feature-flow-lite')
  expect(note).toBe(
    'feature-flow-lite check cache: replayed `go test -race ./...` from a passing run 2m ago on the same tree ' +
      '(fingerprint 3fa2c1d0e9b8a7f6: HEAD 1a2b3c4 + 3 changed files, same toolchain), saving ~41s; ' +
      '`yarn jest` failed (exit 1); it failed at the base commit 1a2b3c4 too (exit 1), so the failure is pre-existing; ' +
      '`yarn eslint .` failed (exit 1); it passed at the base commit 1a2b3c4, so this change broke it.',
  )
  expect(noteFor(parseNotes('pass\tgo vet ./...\tabc\t2.0'), 'p')).toBeUndefined()
  expect(noteFor(parseNotes('hit\tk\tt\th\t1\t5\t3\t12'), 'p')).toContain('waited 12s for another agent running the same check, then replayed')
})

// The engine beneath the plugin: git answers, an in-memory file system, and a
// Bash tool that records the command it ran and writes the wrapper's notes.
function world(on: On, opts: { env?: Record<string, string>; notes?: string } = {}) {
  const ran: string[] = []
  const files: Record<string, string> = {}
  const removed: string[] = []
  mock.env(on, opts.env ?? {})
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('ui.log', () => ({ value: undefined }))
  on('process.run', ($, e) => {
    const argv = [...e.argv]
    const out = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (argv[0] === 'rm') {
      removed.push(argv[2] ?? '')
      delete files[argv[2] ?? '']
      return out('')
    }
    if (argv.includes('--show-toplevel')) return out('/r\n')
    if (argv.includes('--git-common-dir')) return out('/r/.git\n')
    if (argv.includes('HEAD')) return out('1a2b3c4d\n')
    return out('')
  })
  on('fs.exists', ($, e) => ({ value: e.path in files || e.path.endsWith('/hooks/ffcc.sh') }))
  on('fs.read', ($, e) => ({ value: files[e.path] ?? '' }))
  on('fs.write', ($, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    ran.push(e.command)
    const notes = e.command.match(/'(\/r\/\.git\/ff-check-cache\/notes\/[^']+)'/)?.[1]
    if (notes && opts.notes !== undefined) files[notes] = opts.notes
    return { result: { stdout: 'ok', stderr: '', interrupted: false } } as never
  })
  return { ran, files, removed }
}

const bash = ($: { tool: { call: (input: never) => Promise<{ context?: readonly string[] }> } }, command: string, extra = {}) =>
  $.tool.call({ tool: 'Bash', command, ...extra } as never)

test('hook: off unless FEATURE_FLOW_CHECK_CACHE=1 and the skill was invoked', async ($, on) => {
  const w = world(on)
  await bash($, 'go test ./...')
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await bash($, 'go test ./...')
  expect(w.ran).toEqual(['go test ./...', 'go test ./...'])
})

test('hook: on, a check is rewritten, the base commit recorded, and a replay noted', async ($, on) => {
  const w = world(on, { env: { FEATURE_FLOW_CHECK_CACHE: '1' }, notes: 'hit\tgo test ./...\tfff\t1a2b3c4\t2\t30\t60\t0' })
  await bash($, 'go test ./...')
  expect(w.ran).toEqual(['go test ./...']) // before the skill is invoked
  await $.skill.prompt({ skill: 'feature-flow-lite:feature-flow-lite', text: '' })
  expect(w.files['/r/.git/ff-check-cache/base']).toBe('1a2b3c4d\n')

  const out = await bash($, 'go test -count=1 ./... | tail -5')
  expect(w.ran[1]).toMatch(/^'bash' '.*\/hooks\/ffcc\.sh' '\/r\/\.git\/ff-check-cache' '\/r\/\.git\/ff-check-cache\/notes\/[^']+' 'go' 'go test \.\/\.\.\.' -- go test -count=1 \.\/\.\.\. \| tail -5$/)
  expect(out.context).toEqual([
    'feature-flow-lite check cache: replayed `go test ./...` from a passing run 60s ago on the same tree (fingerprint fff: HEAD 1a2b3c4 + 2 changed files, same toolchain), saving ~30s.',
  ])
  expect(w.removed).toHaveLength(1)

  // not a check: untouched, no note
  const plain = await bash($, 'git diff --stat')
  expect(w.ran[2]).toBe('git diff --stat')
  expect(plain.context).toBeUndefined()
})

test('hook: a background call is rewritten but gets no note; a fresh pass gets no note', async ($, on) => {
  const w = world(on, { env: { FEATURE_FLOW_CHECK_CACHE: '1' }, notes: 'pass\tyarn jest\tfff\t30' })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  const bg = await bash($, 'yarn jest', { run_in_background: true })
  expect(w.ran[0]).toContain(`-- yarn jest`)
  expect(bg.context).toBeUndefined()
  const fg = await bash($, 'yarn jest')
  expect(fg.context).toBeUndefined()
})

test("hook: the project file's checks are cached too", async ($, on) => {
  const w = world(on, { env: { FEATURE_FLOW_CHECK_CACHE: '1' } })
  await $.skill.prompt({ skill: 'feature-flow-lite', text: '' })
  await bash($, 'make check')
  expect(w.ran[0]).toBe('make check')
  w.files['/r/FEATURE_FLOW.md'] = '## Checks\n- `make check`\n'
  await bash($, 'make check')
  expect(w.ran[1]).toContain(`'make check' -- make check`)
})
