// The mod's extras (FEATURE_FLOW_EXTRAS=1), the pure parts: the user's request
// in every reviewer handoff, earlier must-fixes carried to later gatekeepers,
// the review panel's three focuses, probe files, and the timeline /ff-usage
// prints. register.ts wires them to hooks; nothing here touches `$`.

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

// The request is what the user typed after the slash command, if any.
export function requestOf(text: string): string {
  return text.replace(/^\s*\/[\w:.-]+\s*/, '').trim()
}

// A handoff that doesn't carry the request word for word gets it appended.
export function withRequest(prompt: string, request: string): string | undefined {
  if (squash(request) === '' || squash(prompt).includes(squash(request))) return undefined
  return `${prompt.trimEnd()}\n\nREQUEST (the user's words, exactly as typed; added by the plugin):\n${request.trim()}`
}

// Every [must-fix] finding in a gatekeeper's report, one line each.
export function mustFixes(report: string): string[] {
  return report
    .split('\n')
    .filter(line => /\[must-fix\]/i.test(line))
    .map(line => squash(line.replace(/^\s*[-*]\s*/, '').replace(/\[must-fix\]\s*/i, '')).slice(0, 300))
    .filter(line => line !== '')
}

// A gatekeeper handoff with no RULED ON list gets the must-fixes earlier
// gatekeepers raised, so a fresh reviewer doesn't reopen what was settled.
export function withRuledOn(prompt: string, raised: readonly string[]): string | undefined {
  if (raised.length === 0 || /^\s*RULED ON:/m.test(prompt)) return undefined
  const lines = raised.slice(-20).map(item => `- ${item}`)
  return (
    `${prompt.trimEnd()}\n\nRULED ON: (added by the plugin) earlier gatekeepers raised these, and the orchestrator ` +
    'fixed or overruled each. Raise one again only with new evidence that it is still wrong.\n' +
    lines.join('\n')
  )
}

export const PANEL_FOCI = {
  request: 'request: every sentence of the request and every criterion, probed in the request\'s own words; wrong or missing criteria.',
  edges:
    'edges: what the new code wraps or stands in for, and every capability and edge input it has (empty, huge, malformed, repeated, concurrent, interrupted, the optional interfaces). Where it wraps something, run the same inputs with and without it across call orders (state changed before and after the first write or commit, flush, hijack or close, trailers, a second call) and diff every output.',
  repo: 'repo: conventions, the sibling and the places it appears, docs, changelog and help text against the code, tests for every new behavior, unrelated edits, the full checks.',
} as const

// A gatekeeper handoff with `FOCUS: panel` becomes three, one per focus.
export function panelPrompts(prompt: string): string[] | undefined {
  if (!/^\s*FOCUS:\s*panel\b.*$/im.test(prompt)) return undefined
  return Object.values(PANEL_FOCI).map(focus => prompt.replace(/^\s*FOCUS:\s*panel\b.*$/im, `FOCUS: ${focus}`))
}

export const isProbe = (path: string) => /^zz_(?:gate|redteam)_/.test(path.slice(path.lastIndexOf('/') + 1))

export type Span = { role: string; startedAt: number; endedAt: number }

// When each subagent ran, from the first one's start: the critical path.
export function timeline(spans: readonly Span[]): string {
  if (spans.length === 0) return ''
  const sorted = [...spans].sort((a, b) => a.startedAt - b.startedAt)
  const t0 = sorted[0]!.startedAt
  const min = (ms: number) => (ms / 60000).toFixed(1).padStart(5)
  const rows = sorted.map(s => `${min(s.startedAt - t0)} – ${min(s.endedAt - t0)}  ${min(s.endedAt - s.startedAt)} min  ${s.role}`)
  return ['timeline (minutes from the first subagent)', ...rows].join('\n')
}
