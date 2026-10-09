import { expect, test } from 'vitest'
import { __unstable__loadDesignSystem } from '.'
import { run } from './test-utils/run'

const css = String.raw

test('anchor-<name> sets anchor-name to a dashed ident', async () => {
  let out = await run(['anchor-tooltip', 'anchor-my-menu'])
  expect(out).toMatch(/\.anchor-tooltip\s*\{\s*anchor-name:\s*--tooltip;?\s*\}/)
  expect(out).toMatch(/\.anchor-my-menu\s*\{\s*anchor-name:\s*--my-menu;?\s*\}/)
})

test('anchor-none and arbitrary anchor values', async () => {
  let out = await run(['anchor-none', 'anchor-[--a,--b]'])
  expect(out).toMatch(/\.anchor-none\s*\{\s*anchor-name:\s*none;?\s*\}/)
  expect(out).toMatch(/anchor-name:\s*--a,\s*--b/)
})

test('anchored-<name> sets position-anchor', async () => {
  let out = await run(['anchored-tooltip', 'anchored-auto', 'anchored-[--menu]'])
  expect(out).toMatch(/\.anchored-tooltip\s*\{\s*position-anchor:\s*--tooltip;?\s*\}/)
  expect(out).toMatch(/\.anchored-auto\s*\{\s*position-anchor:\s*auto;?\s*\}/)
  expect(out).toMatch(/position-anchor:\s*--menu/)
})

test('bare, negative and modified forms produce no CSS', async () => {
  expect(await run(['anchor', 'anchored', '-anchor-tooltip', '-anchored-tooltip', 'anchor-tooltip/50', 'anchored-auto/50'])).toBe('')
})

test('anchor-none and anchored-auto are suggested by IntelliSense', async () => {
  let design = await __unstable__loadDesignSystem(css`
    @theme {
      --spacing: 0.25rem;
    }
  `)
  let names = design.getClassList().map(([name]) => name)
  expect(names).toContain('anchor-none')
  expect(names).toContain('anchored-auto')
})

test('works with variants and important', async () => {
  let out = await run(['hover:anchor-tooltip', 'anchored-auto!'])
  expect(out).toMatch(/anchor-name:\s*--tooltip/)
  expect(out).toMatch(/position-anchor:\s*auto\s*!important/)
})
