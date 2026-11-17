// Answer-key probes for tailwind-anchor (probes/keys.json). Each test name is a key id; it fails
// when that keyed bug is present. Uses only the candidates the request specified.
import { expect, test } from 'vitest'
import { run } from './test-utils/run'

// a dashed ident: -- then name characters (letters, digits, -, _, non-ASCII or escapes)
const DASHED = /^--(?:[A-Za-z0-9_\-\u0080-￿]|\\.)+$/

function decls(out: string, prop: string): string[] {
  return [...out.matchAll(new RegExp(`${prop}:\\s*([^;}]+?)\\s*;?\\s*}`, 'g'))].map((m) => m[1])
}

test('bare-name-invalid', async () => {
  const bad: string[] = []
  for (const name of ['1.5', '50%', 'a.b', '2.5x']) {
    for (const [util, prop] of [['anchor', 'anchor-name'], ['anchored', 'position-anchor']]) {
      const out = await run([`${util}-${name}`])
      for (const v of decls(out, prop)) if (!DASHED.test(v)) bad.push(`${util}-${name} -> ${prop}: ${v}`)
    }
  }
  expect(bad).toEqual([])
})

test('digit-led-rejected', async () => {
  const missing: string[] = []
  for (const name of ['1', '2col', '3d-menu']) {
    for (const [util, prop] of [['anchor', 'anchor-name'], ['anchored', 'position-anchor']]) {
      const out = await run([`${util}-${name}`])
      if (!decls(out, prop).includes(`--${name}`)) missing.push(`${util}-${name} -> ${JSON.stringify(out)}`)
    }
  }
  expect(missing).toEqual([])
})
