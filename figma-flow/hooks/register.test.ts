import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const FIGMA = 'mcp__figma__use_figma'
const EXPORT = '{\n  "variants": {}\n}'

// The tools beneath the mod: every call succeeds unless its command says "fails".
function tools(on: On, written: Record<string, string>) {
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

test('/figma-flow release lets a commit through', async ($, on) => {
  tools(on, {})
  await $.tool.call({ tool: FIGMA, code: 'return 1' })
  await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  await $.command.run({ command: 'figma-flow', args: 'release' } as never)
  const ran = await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"' })

  expect(ran.deny).toBe(undefined)
})

test('the main conversation is told when it edits source after handing off', async ($, on) => {
  tools(on, {})
  await $.tool.call({ tool: FIGMA, code: 'return 1' })
  const before = await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  expect(before.context).toBe(undefined)

  await $.tool.call({ tool: 'Agent', subagent_type: 'feature-flow-lite:implementor', description: 'build', prompt: 'GOAL: x' })
  const after = await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })
  expect(after.deny).toBe(undefined)
  expect(after.context?.join(' ')).toContain('Send fixes to the implementor')

  // its own files are still the main conversation's to write
  const spec = await $.tool.call({ tool: 'Write', file_path: 'tests/button.figma.spec.ts', content: '' })
  expect(spec.context).toBe(undefined)
  // and a subagent's edit gets no note
  const sub = await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b', agentId: 'agent-1' } as never)
  expect(sub.context).toBe(undefined)
})

test('no note outside Figma work', async ($, on) => {
  tools(on, {})
  await $.tool.call({ tool: 'Agent', subagent_type: 'feature-flow-lite:implementor', description: 'build', prompt: 'GOAL: x' })
  const ran = await $.tool.call({ tool: 'Edit', file_path: 'src/button.tsx', old_string: 'a', new_string: 'b' })

  expect(ran.context).toBe(undefined)
})
