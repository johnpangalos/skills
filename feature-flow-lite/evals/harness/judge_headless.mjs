// Run judge.workflow.js without the Workflow tool: each agent() call becomes a headless
// `claude -p` with the same prompt and JSON schema.
//
//   node judge_headless.mjs <challenges.json> <out.json> [--jobs 3] [--model opus]
//
// challenges.json is what the workflow takes as args. Inspectors run --jobs at a time; on a repo
// whose builds are heavy (deno_core), point CARGO_TARGET_DIR at one shared target dir so they
// don't each need their own. Each agent's raw JSON result lands next to out.json in agents/.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [challengesPath, outPath, ...rest] = process.argv.slice(2)
const opt = (name, dflt) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : dflt }
const jobs = Number(opt('jobs', 3))
const model = opt('model', 'opus')
const agentsDir = path.join(path.dirname(path.resolve(outPath)), 'agents')
fs.mkdirSync(agentsDir, { recursive: true })

let running = 0
const waiting = []
async function slot() {
  if (running < jobs) { running++; return }
  await new Promise(resolve => waiting.push(resolve))
}
function release() { const next = waiting.shift(); next ? next() : running-- }

const SCRUB = ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_REMOTE_SESSION_ID', 'CLAUDE_EFFORT', 'CLAUDECODE',
  'CLAUDE_AUTO_BACKGROUND_TASKS', 'CLAUDE_CODE_BG_TASKS_REPORT_RUNNING']

async function agent(prompt, { label, schema, effort } = {}) {
  const file = path.join(agentsDir, label.replace(/[^\w.-]+/g, '_') + '.json')
  if (fs.existsSync(file)) {  // resume: a finished agent isn't re-run
    const done = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (done.structured_output) return done.structured_output
  }
  await slot()
  try {
    const env = { ...process.env }
    for (const k of SCRUB) delete env[k]
    const args = ['-p', prompt, '--model', model, '--effort', effort || 'medium', '--output-format', 'json',
      '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
      '--no-session-persistence', ...(schema ? ['--json-schema', JSON.stringify(schema)] : [])]
    log(`start ${label}`)
    const out = await new Promise(resolve => {
      const p = spawn('claude', args, { cwd: '/tmp', env, stdio: ['ignore', 'pipe', 'inherit'] })
      let buf = ''
      p.stdout.on('data', d => { buf += d })
      p.on('close', () => resolve(buf))
    })
    fs.writeFileSync(file, out)
    let parsed
    try { parsed = JSON.parse(out) } catch { log(`FAILED ${label}: no JSON`); return null }
    log(`done ${label} $${parsed.total_cost_usd?.toFixed(2)}`)
    return parsed.structured_output || null
  } finally { release() }
}
const parallel = thunks => Promise.all(thunks.map(t => t()))
const pipeline = (items, ...stages) => Promise.all(items.map(async item => {
  let value = item
  for (const stage of stages) value = await stage(value, item)
  return value
}))
const log = msg => console.log(new Date().toISOString().slice(11, 19), msg)
const phase = () => {}

const source = fs.readFileSync(path.join(here, 'judge.workflow.js'), 'utf8').replace(/^export const meta/m, 'const meta')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const run = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'log', 'phase', source)
const results = await run(JSON.parse(fs.readFileSync(challengesPath, 'utf8')), agent, parallel, pipeline, log, phase)
fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
log(`wrote ${outPath}`)
