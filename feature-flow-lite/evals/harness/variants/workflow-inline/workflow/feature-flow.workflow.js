export const meta = {
  name: 'feature-flow-lite',
  description: 'Investigator, implementor, checks, simplifier, reviewer and a capped fix loop on the named Haiku agents',
  phases: [
    { title: 'Investigate' },
    { title: 'Implement' },
    { title: 'Simplify' },
    { title: 'Review' },
    { title: 'Fix' },
  ],
}

// args: {goal, files, constraints, criteria, checks_targeted, checks_full: [cmd], run_it,
// checklist, investigate}. criteria is the ACCEPTANCE CRITERIA list (with its hostile inputs),
// passed through word for word.
const A = args
const MAX_ROUNDS = 2
const FULL = A.checks_full.map(c => `- ${c}`).join('\n')

const handoff = extra => [
  `GOAL: ${A.goal}`,
  `FILES: ${A.files}`,
  `CONSTRAINTS: ${A.constraints}`,
  `ACCEPTANCE CRITERIA:\n${A.criteria}`,
  `CHECKS: targeted while working: ${A.checks_targeted}\nfull, once at the end:\n${FULL}`,
  extra,
].filter(Boolean).join('\n')

const role = name => ({ agentType: `feature-flow-lite:${name}`, label: name })

const CHECKS = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, failures: { type: 'string' } },
  required: ['passed', 'failures'],
}

// The orchestrator runs the checks itself in the skill; a script can't, so a Haiku runner
// does, and changes nothing.
const runChecks = (label, phase) => agent(
  `Run each command below from the repo root, exactly as written, one at a time. Don't edit any file or try to fix anything.\n${FULL}\n\n` +
  'Set passed to true only if every command exited 0. In failures, give each failing command and the lines of its output that show what failed (at most ~40 lines in all); leave it empty when everything passed.',
  { label, phase, schema: CHECKS, agentType: 'general-purpose', model: 'haiku', effort: 'low' },
)

const git = (cmd, label, phase) => agent(
  `Run exactly this from the repo root and return only its output, trimmed, with nothing else: ${cmd}`,
  { label, phase, agentType: 'general-purpose', model: 'haiku', effort: 'low' },
)

const blocking = text => /\[blocking\]/i.test(text || '')

let rounds = 0
const ran = []

// 1. Investigator
let findings = ''
if (A.investigate !== false) {
  phase('Investigate')
  findings = await agent(handoff(''), { ...role('investigator'), phase: 'Investigate' })
  ran.push('investigator')
}

// 2. Implementor, then the full checks; a failure is a fix round
phase('Implement')
let impl = await agent(handoff(findings ? `INVESTIGATOR FINDINGS:\n${findings}` : ''), { ...role('implementor'), phase: 'Implement' })
ran.push('implementor')
let checks = await runChecks('checks', 'Implement')

const fix = async (why, label) => {
  rounds++
  impl = await agent(handoff(`FIX ROUND ${rounds} of ${MAX_ROUNDS}. Fix only this, then run the full checks:\n${why}`),
    { ...role('implementor'), label, phase: 'Fix' })
  ran.push('implementor')
  checks = await runChecks(`checks after fix ${rounds}`, 'Fix')
}

while (!checks.passed && rounds < MAX_ROUNDS) {
  await fix(`The full checks fail:\n${checks.failures}`, `implementor fix ${rounds + 1}`)
}
if (!checks.passed) {
  log('checks still fail after the fix rounds; stopping before review')
  return { status: 'fail', stopped_at: 'checks', rounds, ran, checks, implementor: impl }
}

// 3. Simplifier, reverted if it breaks the checks
phase('Simplify')
const snapshot = await git('git add -A && git stash create', 'snapshot', 'Simplify')
const simplified = await agent(
  `ACCEPTANCE CRITERIA:\n${A.criteria}\nCHECKS: full:\n${FULL}\nSimplify the change in \`git diff HEAD\` (new files are staged) without changing behavior.`,
  { ...role('simplifier'), phase: 'Simplify' },
)
ran.push('simplifier')
let simplifier = 'kept'
const afterSimplify = await runChecks('checks after simplifier', 'Simplify')
if (!afterSimplify.passed) {
  const sha = (snapshot || '').trim().split(/\s+/).pop()
  if (/^[0-9a-f]{7,40}$/.test(sha)) {
    await git(`git checkout ${sha} -- . && git add -A`, 'revert simplifier', 'Simplify')
    simplifier = 'reverted'
  } else {
    simplifier = 'broke the checks and no snapshot to revert to'
  }
  log(`simplifier ${simplifier}`)
}

// 4. Reviewer (red team), then up to the remaining fix rounds with incremental reviews
phase('Review')
const reviewExtra = `RUN IT: ${A.run_it}\nPROJECT CHECKLIST: ${A.checklist}\nThe full checks already pass. The change is \`git diff HEAD\` (new files are staged).`
let review = await agent(handoff(reviewExtra), { ...role('reviewer'), phase: 'Review' })
ran.push('reviewer')
const reviews = [review]

while (blocking(review) && rounds < MAX_ROUNDS) {
  await fix(`The reviewer reproduced these; fix every [blocking] finding:\n${review}`, `implementor fix ${rounds + 1}`)
  while (!checks.passed && rounds < MAX_ROUNDS) {
    await fix(`The full checks fail:\n${checks.failures}`, `implementor fix ${rounds + 1}`)
  }
  if (!checks.passed) break
  review = await agent(
    handoff(`${reviewExtra}\nINCREMENTAL REVIEW: re-check only the hunks the fix changed, and whether each earlier finding is fixed:\n${review}`),
    { ...role('reviewer'), label: `reviewer ${rounds + 1}`, phase: 'Fix' },
  )
  ran.push('reviewer')
  reviews.push(review)
}

return {
  status: checks.passed && !blocking(review) ? 'pass' : 'fail',
  rounds,
  ran,
  checks,
  simplifier: `${simplifier}: ${simplified}`,
  implementor: impl,
  last_review: review,
  reviews: reviews.length,
}
