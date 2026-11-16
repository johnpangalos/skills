import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const FIGMA = 'mcp__figma__use_figma'
const EXPORT = '{\n  "variants": {}\n}'

const MEASURED = JSON.stringify({ scripts: { 'test:figma': 'playwright test' } })

// The tools beneath the mod: every call succeeds unless its command says "fails". The project at
// /work has `pkg` as its package.json (by default one with a `test:figma` script), or none (null).
function tools(on: On, written: Record<string, string>, pkg: string | null = MEASURED) {
  on('session.root', () => ({ value: '/work' }) as never)
  on('fs.read', (_$, e) => {
    if (e.path !== '/work/package.json' || pkg === null) throw new Error(`ENOENT: ${e.path}`)

    return { value: pkg } as never
  })
  on('tool.call', (_$, e) => {
    const command = String((e as { command?: unknown }).command ?? '')
    if (command.includes('fails')) return { isError: true, result: 'failed', text: 'failed' }
    const text = e.tool === FIGMA ? EXPORT : 'ok'

    return { result: text, text } as never
  })
  on('fs.write', (_$, e) => {
    written[e.path] = e.text

    return { value: undefined } as never
  })
}

test('a commit goes through when no Figma work has happened', async ($, on) => {
  tools(on, {})
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(ran.deny).toBe(undefined)
})

test('a commit is held after a design edit until the measurement passes', async ($, on) => {
  tools(on, {})
  await $.tool.call({ tool: FIGMA, code: 'return 1' })
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })

  const held = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })
  expect(held.deny).toContain('src/button.tsx')

  await $.tool.call({ tool: 'Bash', command: 'pnpm test:figma # fails' })
  const still = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })
  expect(still.deny).toContain('test:figma')

  await $.tool.call({ tool: 'Bash', command: 'pnpm test:figma' })
  const free = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })
  expect(free.deny).toBe(undefined)
})

// Figma tools used for something other than a build, in a project with nothing to measure.
const UNMEASURED = {
  'no test:figma script': JSON.stringify({ scripts: { test: 'vitest' } }),
  'no package.json': null,
  'a package.json that is not JSON': 'not json',
}
for (const [name, pkg] of Object.entries(UNMEASURED)) {
  test(`a commit goes through after Figma work in a project with ${name}`, async ($, on) => {
    tools(on, {}, pkg)
    await $.tool.call({ tool: FIGMA, code: 'return 1' })
    await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
    const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

    expect(ran.deny).toBe(undefined)
  })
}

test('tests and Figma exports do not need measuring', async ($, on) => {
  tools(on, {})
  await $.tool.call({ tool: FIGMA, code: 'return 1' })
  await $.tool.call({ tool: 'Write', file_path: 'apps/playground/tests/button.figma.spec.ts', content: '' })
  await $.tool.call({ tool: 'Write', file_path: 'apps/playground/figma/button.json', content: '' })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "test: x"' })

  expect(ran.deny).toBe(undefined)
})

test('a marked Figma script has its result saved to the file it names', async ($, on) => {
  const written: Record<string, string> = {}
  tools(on, written)
  const ran = await $.tool.call({
    tool: FIGMA,
    code: '// figma-flow:save apps/playground/figma/button.json\nreturn await exportNode("1:91");',
  })

  // The engine resolves the path against the working directory before the write.
  const [path, text] = Object.entries(written)[0] ?? []
  expect(path?.endsWith('/apps/playground/figma/button.json')).toBe(true)
  expect(text).toBe(`${EXPORT}\n`)
  expect(ran.context?.join(' ')).toContain('saved this result')
})

test('a save outside the project is refused and the result still returned', async ($, on) => {
  const written: Record<string, string> = {}
  tools(on, written)
  const ran = await $.tool.call({ tool: FIGMA, code: '// figma-flow:save ../../etc/x.json\nreturn 1' })

  expect(Object.keys(written)).toEqual([])
  expect(ran.text).toBe(EXPORT)
  expect(ran.context?.join(' ')).toContain('outside the project')
})

// A project at /tmp/work, which is really /private/tmp/work, as on macOS. Only the folders
// listed exist; stat rejects anything else, as for a file not written yet.
function project(on: On) {
  const real: Record<string, string> = {
    '/tmp': '/private/tmp',
    '/tmp/work': '/private/tmp/work',
    '/private': '/private',
    '/private/tmp': '/private/tmp',
    '/private/tmp/work': '/private/tmp/work',
  }
  on('session.cwd', () => ({ value: '/tmp/work' }) as never)
  on('fs.stat', (_$, e) => {
    const realPath = real[e.path]
    if (realPath === undefined) throw new Error(`ENOENT: ${e.path}`)

    return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: e.path !== realPath, realPath } } as never
  })
}

test('an absolute save inside the project is saved, through a symbolic link', async ($, on) => {
  const written: Record<string, string> = {}
  tools(on, written)
  project(on)
  const ran = await $.tool.call({
    tool: FIGMA,
    code: '// figma-flow:save /private/tmp/work/figma/button.json\nreturn await exportNode("1:91");',
  })

  expect(Object.keys(written)).toEqual(['/private/tmp/work/figma/button.json'])
  expect(ran.context?.join(' ')).toContain('saved this result')
})

test('an absolute save outside the project is refused', async ($, on) => {
  const written: Record<string, string> = {}
  tools(on, written)
  project(on)
  for (const path of ['/private/tmp/workshop/x.json', '/private/tmp/x.json', '/etc/x.json', '/tmp/work/../x.json']) {
    const ran = await $.tool.call({ tool: FIGMA, code: `// figma-flow:save ${path}\nreturn 1` })
    expect(ran.context?.join(' ')).toContain('outside the project')
  }
  expect(Object.keys(written)).toEqual([])
})

test('/figma-hold release lets a commit through', async ($, on) => {
  tools(on, {})
  await $.tool.call({ tool: FIGMA, code: 'return 1' })
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  await $.command.run({ command: 'figma-hold', args: 'release' } as never)
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(ran.deny).toBe(undefined)
})

test('invoking the skill counts as Figma work', async ($, on) => {
  tools(on, {})
  on('skill.prompt', (_$, e) => ({ text: e.text }) as never)
  await $.skill.prompt({ skill: 'figma-flow:figma-flow', text: 'x' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  const held = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(held.deny).toContain('src/button.tsx')
})

test('invoking figma-flow:setup counts as Figma work', async ($, on) => {
  tools(on, {})
  on('skill.prompt', (_$, e) => ({ text: e.text }) as never)
  await $.skill.prompt({ skill: 'figma-flow:setup', text: 'x' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'src/fonts.css', old_string: 'a', new_string: 'b' })
  const held = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(held.deny).toContain('src/fonts.css')
})

test('invoking figma-flow:component counts as Figma work', async ($, on) => {
  tools(on, {})
  on('skill.prompt', (_$, e) => ({ text: e.text }) as never)
  await $.skill.prompt({ skill: 'figma-flow:component', text: 'x' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  const held = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(held.deny).toContain('src/button.tsx')
})

test('invoking figma-flow:page counts as Figma work', async ($, on) => {
  tools(on, {})
  on('skill.prompt', (_$, e) => ({ text: e.text }) as never)
  await $.skill.prompt({ skill: 'figma-flow:page', text: 'x' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'src/page.tsx', old_string: 'a', new_string: 'b' })
  const held = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(held.deny).toContain('src/page.tsx')
})

test("another plugin's component skill is not Figma work", async ($, on) => {
  tools(on, {})
  on('skill.prompt', (_$, e) => ({ text: e.text }) as never)
  await $.skill.prompt({ skill: 'other:component', text: 'x' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(ran.deny).toBe(undefined)
})

test("another plugin's page skill is not Figma work", async ($, on) => {
  tools(on, {})
  on('skill.prompt', (_$, e) => ({ text: e.text }) as never)
  await $.skill.prompt({ skill: 'other:page', text: 'x' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'src/page.tsx', old_string: 'a', new_string: 'b' })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(ran.deny).toBe(undefined)
})

test('figma-flow:components, figma-flow:pager and xfigma-flow:page are not Figma work', async ($, on) => {
  tools(on, {})
  on('skill.prompt', (_$, e) => ({ text: e.text }) as never)
  for (const skill of ['figma-flow:components', 'figma-flow:pager', 'xfigma-flow:page']) {
    await $.skill.prompt({ skill, text: 'x' } as never)
  }
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(ran.deny).toBe(undefined)
})

test("another plugin's skill named setup is not Figma work", async ($, on) => {
  tools(on, {})
  on('skill.prompt', (_$, e) => ({ text: e.text }) as never)
  await $.skill.prompt({ skill: 'other:setup', text: 'x' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(ran.deny).toBe(undefined)
})
