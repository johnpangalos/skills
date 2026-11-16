import { test, expect } from 'claude-code/testing'
import { timeline } from './timeline'

test('timeline: subagents in start order, in minutes from the first', () => {
  const t = timeline([
    { role: 'gatekeeper', startedAt: 180_000, endedAt: 300_000 },
    { role: 'implementor', startedAt: 60_000, endedAt: 120_000 },
  ])
  expect(t.split('\n')).toEqual([
    'timeline (minutes from the first subagent)',
    '  0.0 –   1.0    1.0 min  implementor',
    '  2.0 –   4.0    2.0 min  gatekeeper',
  ])
})

test('timeline: nothing to show without spans', () => {
  expect(timeline([])).toBe('')
})
