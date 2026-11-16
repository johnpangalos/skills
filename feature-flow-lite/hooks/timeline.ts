// The timeline /ff-usage prints under its table: when each subagent ran.

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
