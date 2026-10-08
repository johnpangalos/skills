export const meta = {
  name: 'feature-flow-blind-judging',
  description: 'Blind-judge builds: one inspector per build, one verifying judge per challenge',
  phases: [
    { title: 'Inspect', detail: 'one agent per anonymized build: build, run, probe edge cases, score' },
    { title: 'Judge', detail: 'one judge per challenge: reproduce claimed defects, score and rank' },
  ],
}

const SCORE = { type: 'number', minimum: 1, maximum: 10 }
const INSPECT = {
  type: 'object',
  properties: {
    letter: { type: 'string' },
    overall: SCORE,
    scores: {
      type: 'object',
      properties: { correctness: SCORE, robustness: SCORE, code_quality: SCORE, tests: SCORE, docs: SCORE, product: SCORE },
      required: ['correctness', 'robustness', 'code_quality', 'tests', 'docs', 'product'],
    },
    defects: {
      type: 'array',
      items: {
        type: 'object',
        properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, what: { type: 'string' }, evidence: { type: 'string' } },
        required: ['severity', 'what', 'evidence'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    stats: {
      type: 'object',
      properties: { files: { type: 'number' }, source_lines: { type: 'number' }, test_cases: { type: 'number' } },
      required: ['files', 'source_lines', 'test_cases'],
    },
    summary: { type: 'string' },
  },
  required: ['letter', 'overall', 'scores', 'defects', 'strengths', 'stats', 'summary'],
}
const JUDGE = {
  type: 'object',
  properties: {
    ranking: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          letter: { type: 'string' },
          score: SCORE,
          confirmed_defects: { type: 'array', items: { type: 'string' } },
          refuted_defects: { type: 'array', items: { type: 'string' } },
          rationale: { type: 'string' },
        },
        required: ['letter', 'score', 'confirmed_defects', 'refuted_defects', 'rationale'],
      },
    },
    verdict: { type: 'string' },
  },
  required: ['ranking', 'verdict'],
}

const PROBES = {
  website:
    'Serve or open the pages, read the HTML/CSS/JS, and read the PNG screenshots (desktop, and 360px with JavaScript off). Check the genre filter with and without JS, keyboard navigation and focus styles, heading structure, colour contrast, form labelling and error handling, content depth and consistency, and whether anything is decorative but non-functional.',
  api:
    'Build it, run its tests, start the server on a free port and probe it with curl: the full contract, then edge cases beyond it (wrong content type, huge or empty bodies, unknown fields, trailing slashes, PATCH with null/empty values, duplicate tags, method not allowed, concurrent writes, graceful shutdown).',
  library:
    'Install dependencies in your copy (pnpm install --frozen-lockfile --ignore-scripts --prefer-offline), read the change in the .diff file next to the build, run the new tests and `pnpm vitest run packages/tailwindcss`, then probe the behavior with small throwaway vitest files that call the package\'s compile API (see src/test-utils/run.ts): edge cases beyond the spec (names with digits, uppercase or escapes; arbitrary values with spaces or underscores; variants, important and the prefix option; ordering among other utilities; IntelliSense listing), and how well the change follows the repo\'s existing patterns (registration style, doc comments, test style, changelog wording).',
  cli:
    'Build it, run its tests, then use it with SPEND_FILE pointing into a temp dir: the full contract, then edge cases beyond it (amounts like 1., .5, 1e3, 007, very large; unicode notes; missing or corrupt data file; --help; concurrent invocations; what happens to the data file if a write is interrupted).',
}
const PRODUCT = {
  website: 'visual design, content depth and realism, navigation, filtering UX, accessibility',
  api: 'API design and HTTP semantics beyond the minimum (validation messages, content types, limits, shutdown, logging)',
  cli: 'CLI ergonomics (help, output alignment, messages) and data safety (atomic writes, corrupt-file handling)',
  library: 'fit with the codebase: follows its existing patterns, naming, doc comments, test style and changelog conventions; a maintainer would merge it as is',
  feature: 'fit with the codebase: follows its existing patterns, naming, doc comments, test style and changelog/docs conventions; a maintainer would merge it as is',
}
// a challenge can pass its own `probe` text; feature changes in an existing repo always do

function kindOf(ch) {
  return ch.kind === 'library' || ch.kind === 'feature' ? 'a feature change in an existing open-source repo' : 'a small greenfield coding task'
}

function inspectPrompt(ch, b) {
  return `You are inspecting one anonymized build of ${kindOf(ch)}. You don't know who or what built it; judge only what is there and don't speculate about its origin.

TASK THE BUILDER WAS GIVEN:
${ch.prompt}

BUILD ${b.letter}: ${b.dir}${b.shots ? `\nSCREENSHOTS: ${b.shots}` : ''}${b.diff ? `\nCHANGE (diff against the original repo): ${b.diff}` : ''}
Look only at this build. Don't open sibling folders. Before building or running anything, copy it to a fresh folder: rm -rf /tmp/inspect-${ch.id}-${b.letter} && cp -r ${b.dir} /tmp/inspect-${ch.id}-${b.letter}, and work in the copy.

What to do: read all of the ${b.diff ? 'change' : 'code'}, then ${ch.probe || PROBES[ch.kind]}
Record every defect with severity (blocker: a spec requirement fails; major: a real bug or a serious quality problem a reviewer would block on; minor: everything else) and evidence a skeptic could reproduce (the command and what it printed, or file:line).

Score 1-10 each: correctness (meets the spec, including edge cases), robustness, code_quality (structure, idiom, clarity; more code is not better), tests (do they test meaningful behavior), docs (${b.diff ? 'the docs, changelog and comments the repo expects for a change like this' : 'README and run instructions'}), product (${PRODUCT[ch.kind]}). overall is your holistic 1-10. Calibrate: 5 = works with notable gaps, 7 = good, 8 = ${b.diff ? 'a maintainer would merge it with at most small edits' : 'solid production-quality small project'}, 10 = exemplary. stats: files, non-blank source lines (excluding lockfiles and generated files), test cases.`
}

function judgePrompt(ch, reports) {
  const builds = ch.builds.map(b => `${b.letter}: ${b.dir}${b.shots ? ` (screenshots ${b.shots})` : ''}${b.diff ? ` (diff ${b.diff})` : ''}`).join('\n')
  return `You are the final judge comparing ${ch.builds.length} anonymized builds of the same task. You don't know who or what built them; don't speculate.

TASK:
${ch.prompt}

BUILDS (read-only; before building or running one, copy it to a fresh folder: rm -rf /tmp/judge-${ch.id}-<letter> && cp -r <dir> /tmp/judge-${ch.id}-<letter>):
${builds}

Independent inspectors scored each build (they may be calibrated differently from each other):
${JSON.stringify(reports, null, 1)}

1. Re-check every blocker and major defect the inspectors claimed by reproducing it yourself. List each as confirmed or refuted with a one-line reason. Also look for anything important an inspector missed.
2. Then score every build 1-10 on one shared scale (5 = works with notable gaps, 8 = ${ch.builds.some(b => b.diff) ? 'a maintainer would merge it with at most small edits' : 'solid production-quality small project'}), weighing correctness and robustness most, then code quality and tests, then product polish and docs. Don't reward size or features beyond the spec unless they make the result better for its user.
3. ranking: best first. verdict: 2-4 sentences on what separates the builds.`
}

const results = await pipeline(
  args,
  ch =>
    parallel(
      ch.builds.filter(b => !(ch.reports || []).some(r => r.letter === b.letter)).map(b => () =>
        agent(inspectPrompt(ch, b), { label: `inspect ${ch.id} ${b.letter}`, phase: 'Inspect', schema: INSPECT, effort: 'medium' })
      )
    ).then(reports => [...(ch.reports || []), ...reports.filter(Boolean)].sort((a, b) => a.letter.localeCompare(b.letter))),
  (reports, ch) => {
    log(`${ch.id}: ${reports.length}/${ch.builds.length} inspections back, judging`)
    return agent(judgePrompt(ch, reports), { label: `judge ${ch.id}`, phase: 'Judge', schema: JUDGE, effort: 'high' })
      .then(judge => ({ id: ch.id, reports, judge }))
  }
)
return results.filter(Boolean)