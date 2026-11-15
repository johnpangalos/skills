import { test, expect } from 'claude-code/testing'
import { heavyOf, noteFor, parseNotes, planRewrite, timeoutFor, wrapperWords } from './heavy'
import { segments, tokenize } from './shell'

const SETUP = { script: '/p/hooks/heavy.pl', pool: '/tmp/claude-heavy-501', cores: 9, mem: 12288 }

const of = (command: string) => {
  const tokens = tokenize(command)
  const seg = tokens && segments(tokens)[0]
  return seg && heavyOf(seg, SETUP.cores)
}
const kindOf = (command: string) => of(command)?.kind

test('heavy commands are recognized, directly and through package runners', () => {
  expect(kindOf('cargo test --workspace')).toBe('cargo test')
  expect(kindOf('cargo b --release')).toBe('cargo build')
  expect(kindOf('cargo clippy -- -D warnings')).toBe('cargo clippy')
  expect(kindOf('go test ./...')).toBe('go test')
  expect(kindOf('npx playwright test e2e/')).toBe('playwright test')
  expect(kindOf('pnpm exec playwright test')).toBe('playwright test')
  expect(kindOf('yarn jest src')).toBe('jest')
  expect(kindOf('npx vitest run')).toBe('vitest')
  expect(kindOf('node_modules/.bin/tsc --noEmit -p .')).toBe('tsc')
  expect(kindOf('tsgo --noEmit')).toBe('tsgo')
  expect(kindOf('npx next build')).toBe('next build')
  expect(kindOf('vite build')).toBe('vite build')
  expect(kindOf('docker buildx build -t x .')).toBe('docker build')
  expect(kindOf('yarn test')).toBe('yarn test')
  expect(kindOf('npm run build')).toBe('npm build')
  expect(kindOf('npm test')).toBe('npm test')
  expect(kindOf('pnpm typecheck')).toBe('pnpm typecheck')
})

test('servers, watch modes, interactive runs and light commands are left alone', () => {
  for (const command of [
    'cargo run --bin server',
    'cargo fmt',
    'go run .',
    'npx vitest',
    'jest --watch',
    'tsc --watch',
    'tsc -w -p .',
    'npx playwright test --ui',
    'npx playwright show-report',
    'next dev',
    'vite',
    'yarn dev',
    'npm run lint',
    'npm build',
    'yarn test --watch',
    'ls -la',
    'git status',
    'CLAUDE_HEAVY=0 cargo test',
    'CLAUDE_HEAVY_SLOT=1 cargo test',
  ]) {
    expect([command, kindOf(command)]).toEqual([command, undefined])
  }
})

test('weights: tools that take a hint start with one core, others need their whole weight', () => {
  expect(of('cargo test')).toMatchObject({ cores: 9, minCores: 1, hint: 'env:CARGO_BUILD_JOBS' })
  expect(of('npx playwright test')).toMatchObject({ cores: 9, minCores: 1, hint: 'append:--workers=' })
  expect(of('yarn jest')).toMatchObject({ minCores: 1, hint: 'append:--maxWorkers=' })
  expect(of('yarn test')).toMatchObject({ cores: 9, minCores: 9 })
  expect(of('yarn test')?.hint).toBe(undefined)
  expect(of('tsc --noEmit')).toMatchObject({ cores: 1, minCores: 1, mem: 4096 })
  expect(of('tsgo')).toMatchObject({ cores: 4, minCores: 4, mem: 6144 })
})

test('an inserted hint lands after the tool word, past timeout and runners', () => {
  expect(of('go test ./...')?.hint).toBe('after:1:-p=')
  expect(of('timeout 600 go test ./...')?.hint).toBe('after:3:-p=')
  expect(of('timeout -s KILL 600 go vet ./...')?.hint).toBe('after:5:-p=')
})

test('the key is the command with its env prefix; the wrapper goes before timeout', () => {
  const h = of('RUST_LOG=debug timeout 900 cargo test -p core')
  expect(h?.key).toBe('RUST_LOG=debug timeout 900 cargo test -p core')
  expect(h?.at).toBe(1)
})

test('planRewrite wraps each heavy sub-command and leaves the rest', () => {
  const plan = planRewrite('cd crates/core && cargo build && cargo test 2>&1 | tail -20; echo done', SETUP, '/n/1')
  expect(plan?.wrapped.map(w => w.kind)).toEqual(['cargo build', 'cargo test'])
  const head = wrapperWords(SETUP, { kind: 'cargo build', key: 'cargo build', cores: 9, mem: 4096, minCores: 1, hint: 'env:CARGO_BUILD_JOBS' }, '/n/1')
  expect(plan?.command.startsWith(`cd crates/core && perl /p/hooks/heavy.pl --dir /tmp/claude-heavy-501 --kind 'cargo build' --key 'cargo build'`)).toBe(true)
  expect(plan?.command).toContain(`${head.slice(-1)[0]} cargo build && perl`)
  expect(plan?.command.endsWith('-- cargo test 2>&1 | tail -20; echo done')).toBe(true)
})

test('planRewrite keeps env prefixes in front of the wrapper', () => {
  const plan = planRewrite('CI=1 yarn jest', SETUP)
  expect(plan?.command.startsWith('CI=1 perl ')).toBe(true)
  expect(plan?.command.endsWith(' -- yarn jest')).toBe(true)
  expect(plan?.wrapped[0]?.key).toBe('CI=1 yarn jest')
})

test('planRewrite leaves alone what it cannot parse, and what has nothing heavy', () => {
  expect(planRewrite('cargo test `echo x`', SETUP)).toBe(undefined)
  expect(planRewrite('cat <<EOF\ncargo test\nEOF', SETUP)).toBe(undefined)
  expect(planRewrite('git diff && ls', SETUP)).toBe(undefined)
})

test("inside the check cache's wrapper, the limiter goes after its --, so a replayed pass takes no slot", () => {
  const ffcc = `bash '/f/hooks/ffcc.sh' '/r/.git/ff-check-cache' '/n' rust 'cargo test' -- cargo test`
  const plan = planRewrite(ffcc, SETUP)
  expect(plan?.command.startsWith(`bash '/f/hooks/ffcc.sh' '/r/.git/ff-check-cache' '/n' rust 'cargo test' -- perl /p/hooks/heavy.pl`)).toBe(true)
  expect(plan?.command.endsWith(' -- cargo test')).toBe(true)
  expect(planRewrite(plan!.command, SETUP)).toBe(undefined)
})

test('a command already behind the limiter is not wrapped twice', () => {
  const once = planRewrite('cargo test', SETUP)!.command
  expect(planRewrite(once, SETUP)).toBe(undefined)
})

test('the note says how long it waited and on how many cores it ran', () => {
  const waits = parseNotes('waited\tcargo test\t130\t2\t4\nnoise\n')
  expect(waits).toEqual([{ key: 'cargo test', seconds: 130, ahead: 2, cores: 4 }])
  const note = noteFor(waits, 'heavy-limiter', 9, false)
  expect(note).toContain('`cargo test` waited 2 min for a machine-wide slot behind 2 heavy commands')
  expect(note).toContain('ran with 4 of 9 cores')
  expect(note).toContain('run_in_background')
  expect(noteFor([], 'heavy-limiter', 9, false)).toBe(undefined)
})

test('a call expected to wait gets the wait added to its timeout, up to 10 minutes', () => {
  expect(timeoutFor(undefined, 0)).toBe(undefined)
  expect(timeoutFor(undefined, 60)).toBe(180_000)
  expect(timeoutFor(300_000, 60)).toBe(360_000)
  expect(timeoutFor(500_000, 900)).toBe(600_000)
})
