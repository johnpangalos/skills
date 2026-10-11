import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Flow } from '../types'

const flow = atom({ plugin: 'figma-flow', key: 'flow' } as const, {
  isActive: false,
  unmeasured: [],
  lastMeasure: 'none',
  isReleased: false,
  hasHandedOff: false,
} satisfies Flow as Flow)

// `// figma-flow:save apps/playground/figma/button.json` as the first line of a use_figma
// script: the result is written to that file instead of being retyped by the model.
const SAVE = /^\s*\/\/\s*figma-flow:save\s+(\S+)/
// Source the design is built in. Tests, exports and config don't need measuring again.
const SOURCE = /\.(tsx|jsx|ts|js|css)$/
const NOT_SOURCE = /(^|\/)(tests?|figma|node_modules)\/|\.(test|spec|config)\.|\.d\.ts$/
const MEASURE = /\btest:figma\b/
const COMMIT = /\bgit\s+(commit|push)\b/
const IMPLEMENTOR = /implement/i

const isFigmaTool = (tool: string) => /^mcp__.*figma/i.test(tool) || tool.endsWith('__use_figma')
const isInside = (path: string) => !path.startsWith('/') && !path.split('/').includes('..')

export const register: Register = on => {
  // Invoking the skill is Figma work, even when the export is already saved and no Figma tool runs.
  on('skill.prompt', async ($, e, next) => {
    if (/(^|:)figma-flow$/.test(e.skill)) {
      await update($, flow, now => ({ ...now, isActive: true, hasHandedOff: false }))
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
        now.isReleased ? 'The hold is released.' : 'Commits are held until `pnpm test:figma` passes.',
      ].join('\n'),
    }
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const input = e as unknown as {
      code?: unknown
      command?: unknown
      file_path?: unknown
      subagent_type?: unknown
      description?: unknown
    }

    // Handing the build to an implementor: from here the main conversation shouldn't edit source.
    if (tool === 'Agent' && IMPLEMENTOR.test(`${String(input.subagent_type ?? '')} ${String(input.description ?? '')}`)) {
      await update($, flow, now => (now.hasHandedOff ? now : { ...now, hasHandedOff: true }))

      return next(e)
    }

    if (isFigmaTool(tool)) {
      await update($, flow, now => (now.isActive ? now : { ...now, isActive: true }))
      const path = typeof input.code === 'string' ? SAVE.exec(input.code)?.[1] : undefined
      const ran = await next(e)
      if (path === undefined || ran.deny !== undefined || ran.isError === true || ran.text === undefined) return ran
      if (!isInside(path)) {
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
      if (COMMIT.test(input.command) && now.isActive && !now.isReleased && now.unmeasured.length > 0) {
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
      // A note, not a refusal: the edit stands, and the model reads this after it.
      if (now.isActive && now.hasHandedOff && isSource && e.agentId === undefined && ran.deny === undefined && ran.isError !== true) {
        return {
          ...ran,
          context: [
            ...(ran.context ?? []),
            `figma-flow: you edited ${path} yourself after handing the build to an implementor. ` +
              'Send fixes to the implementor with the failing lines, however small; the main conversation ' +
              'writes only the project file, exports and the Figma test.',
          ],
        }
      }

      return ran
    }

    return next(e)
    // A fault in this mod must not stop work: let the call through as it was.
  }).catch(($, e, next) => next(e))
}
