import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Flow } from '../types'

const flow = atom({ plugin: 'figma-flow', key: 'flow' } as const, {
  isActive: false,
  unmeasured: [],
  lastMeasure: 'none',
  isReleased: false,
} satisfies Flow as Flow)

// `// figma-flow:save apps/playground/figma/button.json` as the first line of a use_figma
// script: the result is written to that file instead of being retyped by the model.
const SAVE = /^\s*\/\/\s*figma-flow:save\s+(\S+)/
// Source the design is built in. Tests, exports and config don't need measuring again.
const SOURCE = /\.(tsx|jsx|ts|js|css)$/
const NOT_SOURCE = /(^|\/)(tests?|figma|node_modules)\/|\.(test|spec|config)\.|\.d\.ts$/
const MEASURE = /\btest:figma\b/
const COMMIT = /\bgit\s+(commit|push)\b/

const isFigmaTool = (tool: string) => /^mcp__.*figma/i.test(tool) || tool.endsWith('__use_figma')
// Where a save may go: inside the project, by a relative path or an absolute one. Absolute paths
// are compared where they really land, so a symbolic link in either (macOS's /tmp is
// /private/tmp) doesn't matter; the file and its folders may not exist yet, so the nearest one
// that does is resolved and the rest added back.
async function isInside($: EngineInterface, path: string) {
  if (path.split('/').includes('..')) return false
  if (!path.startsWith('/')) return true
  const real = async (at: string) => (await $.fs.stat(at, { resolve: true }).catch(() => undefined))?.realPath
  const cwd = await $.session.cwd()
  const root = (await real(cwd)) ?? cwd
  for (let cut = path.length; cut > 0; cut = path.lastIndexOf('/', cut - 1)) {
    const landed = await real(path.slice(0, cut))
    if (landed !== undefined) return `${landed}${path.slice(cut)}`.startsWith(`${root}/`)
  }
  return false
}

// Whether the project has a measurement to wait for: a `test:figma` script in the package.json at
// its root. Without one nothing can pass, so holding a commit would only wait for a release; Figma
// tools used for anything but a build (reading a file, an eval) shouldn't hold the repository.
async function hasMeasurement($: EngineInterface) {
  const text = await $.fs.read(`${await $.session.root()}/package.json`).catch(() => undefined)
  if (typeof text !== 'string') return false
  try {
    const { scripts } = JSON.parse(text) as { scripts?: Record<string, unknown> }
    return typeof scripts?.['test:figma'] === 'string'
  } catch {
    return false
  }
}

export const register: Register = on => {
  // Invoking the skill is Figma work, even when the export is already saved and no Figma tool runs.
  on('skill.prompt', async ($, e, next) => {
    if (/(^|:)figma-flow$/.test(e.skill)) {
      await update($, flow, now => (now.isActive ? now : { ...now, isActive: true }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'figma-flow',
      description: 'Show what figma-flow is holding; "release" lets a commit through unmeasured',
      argumentHint: '[release]',
    })

    return next(e)
  })

  on('command.run', { command: 'figma-flow' }, async ($, e) => {
    if (e.args.trim() === 'release') {
      await update($, flow, now => ({ ...now, isReleased: true }))
      $.ui.status(undefined)

      return { text: 'figma-flow: released. Commits go through without a passing measurement.' }
    }
    const now = await read($, flow)
    if (!now.isActive) return { text: 'figma-flow: idle. No Figma tool has been called in this session.' }

    return {
      text: [
        `figma-flow: last measurement ${now.lastMeasure}.`,
        now.unmeasured.length === 0
          ? 'Nothing is waiting to be measured.'
          : `Edited since it last passed:\n${now.unmeasured.map(path => `  ${path}`).join('\n')}`,
        now.isReleased
          ? 'The hold is released.'
          : (await hasMeasurement($))
            ? 'Commits are held until `pnpm test:figma` passes.'
            : 'Commits are not held: the project has no `test:figma` script.',
      ].join('\n'),
    }
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const input = e as unknown as { code?: unknown; command?: unknown; file_path?: unknown }

    if (isFigmaTool(tool)) {
      await update($, flow, now => (now.isActive ? now : { ...now, isActive: true }))
      const path = typeof input.code === 'string' ? SAVE.exec(input.code)?.[1] : undefined
      const ran = await next(e)
      if (path === undefined || ran.deny !== undefined || ran.isError === true || ran.text === undefined) return ran
      if (!(await isInside($, path))) {
        return { ...ran, context: [...(ran.context ?? []), `figma-flow did not save: ${path} is outside the project.`] }
      }
      await $.fs.write(path, ran.text.endsWith('\n') ? ran.text : `${ran.text}\n`)

      return {
        ...ran,
        context: [
          ...(ran.context ?? []),
          `figma-flow saved this result (${ran.text.length} characters) to ${path}. Do not write that file yourself.`,
        ],
      }
    }

    if (tool === 'Bash' && typeof input.command === 'string') {
      const now = await read($, flow)
      const isHeld = COMMIT.test(input.command) && now.isActive && !now.isReleased && now.unmeasured.length > 0
      if (isHeld && (await hasMeasurement($))) {
        return {
          deny:
            `figma-flow: ${now.unmeasured.length} file(s) changed since the Figma measurement last passed ` +
            `(${now.unmeasured.slice(0, 5).join(', ')}). Run \`pnpm test:figma\` and fix what it reports, ` +
            'then commit. Only the person can lift this, with /figma-flow release.',
        }
      }
      const ran = await next(e)
      if (MEASURE.test(input.command) && ran.deny === undefined) {
        const hasPassed = ran.isError !== true
        await update($, flow, state => ({
          ...state,
          lastMeasure: hasPassed ? ('passed' as const) : ('failed' as const),
          unmeasured: hasPassed ? [] : state.unmeasured,
        }))
        if (hasPassed) $.ui.status(undefined)
      }

      return ran
    }

    if ((tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') && typeof input.file_path === 'string') {
      const path = input.file_path
      const ran = await next(e)
      const now = await read($, flow)
      const isSource = SOURCE.test(path) && !NOT_SOURCE.test(path)
      if (now.isActive && isSource && ran.deny === undefined && ran.isError !== true && !now.unmeasured.includes(path)) {
        const after = await update($, flow, state => ({ ...state, unmeasured: [...state.unmeasured, path] }))
        if (!now.isReleased) $.ui.status(`figma: ${after.unmeasured.length} unmeasured`)
      }
      return ran
    }

    return next(e)
    // A fault in this mod must not stop work: let the call through as it was.
  }).catch(($, e, next) => next(e))
}
