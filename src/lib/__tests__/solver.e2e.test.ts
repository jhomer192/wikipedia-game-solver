import { describe, it, expect, afterAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { solve, type VisitedStep } from '../solver'

interface CaseResult {
  name: string
  start: string
  end: string
  found: boolean
  hops: number
  attempts: number
  elapsedMs: number
  apiCalls: number
  candidatesScored: number
  path: string[]
  stuckReason?: string
}

const CASES: { name: string; start: string; end: string }[] = [
  { name: '01 Tom Siebel → Donovan Mitchell', start: 'Tom Siebel', end: 'Donovan Mitchell' },
  { name: '02 Jennie (singer) → Amelia Earhart', start: 'Jennie (singer)', end: 'Amelia Earhart' },
  { name: '03 Coffee → Mount Everest', start: 'Coffee', end: 'Mount Everest' },
  { name: '04 Python → Leonardo da Vinci', start: 'Python (programming language)', end: 'Leonardo da Vinci' },
  { name: '05 Taylor Swift → World War II', start: 'Taylor Swift', end: 'World War II' },
  { name: '06 Photosynthesis → SpaceX', start: 'Photosynthesis', end: 'SpaceX' },
  { name: '07 Dog → Albert Einstein', start: 'Dog', end: 'Albert Einstein' },
]

const MAX_HOPS = 15
const HARD_TIMEOUT_MS = 90_000

const results: CaseResult[] = []

async function runCase(name: string, start: string, end: string): Promise<CaseResult> {
  const t0 = Date.now()
  let path: VisitedStep[] = []
  let found = false
  let attempts = 1
  let apiCalls = 0
  let candidatesScored = 0
  let stuckReason: string | undefined

  const c = new AbortController()
  const timer = setTimeout(() => c.abort(), HARD_TIMEOUT_MS)

  try {
    for await (const ev of solve({ start, end, maxHops: MAX_HOPS, signal: c.signal })) {
      if (ev.type === 'step') path.push(ev.step)
      else if (ev.type === 'found') {
        path.push(ev.step)
        found = true
      } else if (ev.type === 'stuck') stuckReason = ev.reason
      else if (ev.type === 'restart') {
        // Count only the winning attempt's hops — reset the path when the
        // solver backs up to start with an accumulated visited set.
        path = []
        attempts = ev.attempt + 1
      } else if (ev.type === 'stats') {
        apiCalls = ev.apiCalls
        candidatesScored = ev.candidatesScored
      }
    }
  } finally {
    clearTimeout(timer)
  }

  return {
    name,
    start,
    end,
    found,
    hops: Math.max(path.length - 1, 0),
    attempts,
    elapsedMs: Date.now() - t0,
    apiCalls,
    candidatesScored,
    path: path.map((s) => s.title),
    stuckReason,
  }
}

function renderSummary(rs: CaseResult[]): string {
  const pass = rs.filter((r) => r.found).length
  const lines = [
    '═══════════════════════════════════════════════════════════════════════════',
    `Wikipedia Solver e2e summary — ${pass}/${rs.length} passed`,
    '═══════════════════════════════════════════════════════════════════════════',
  ]
  for (const r of rs) {
    lines.push(
      `  ${r.found ? '✓' : '✗'}  ${r.name.padEnd(48)}  ` +
        `hops=${String(r.hops).padStart(2)}  ` +
        `attempts=${r.attempts}  ` +
        `time=${(r.elapsedMs / 1000).toFixed(1).padStart(5)}s  ` +
        `api=${String(r.apiCalls).padStart(3)}  ` +
        `scored=${String(r.candidatesScored).padStart(4)}`,
    )
    lines.push(`      path:  ${r.path.join(' → ')}`)
    if (r.stuckReason) lines.push(`      stuck: ${r.stuckReason}`)
  }
  const totalTime = rs.reduce((a, b) => a + b.elapsedMs, 0) / 1000
  const totalApi = rs.reduce((a, b) => a + b.apiCalls, 0)
  const totalScored = rs.reduce((a, b) => a + b.candidatesScored, 0)
  lines.push(
    '───────────────────────────────────────────────────────────────────────────',
    `  totals:  time=${totalTime.toFixed(1)}s  api=${totalApi}  scored=${totalScored}`,
    '═══════════════════════════════════════════════════════════════════════════',
  )
  return lines.join('\n')
}

describe.sequential('solver e2e (live Wikipedia API)', () => {
  for (const tc of CASES) {
    it(tc.name, async () => {
      const r = await runCase(tc.name, tc.start, tc.end)
      results.push(r)
      const tag = r.found ? 'PASS' : 'FAIL'
      console.log(
        `  [${tag}] ${r.name}  hops=${r.hops}  attempts=${r.attempts}  ` +
          `time=${(r.elapsedMs / 1000).toFixed(1)}s  api=${r.apiCalls}  ` +
          `path=${r.path.join(' → ')}` +
          (r.stuckReason ? `  stuck: ${r.stuckReason}` : ''),
      )
      expect(r.found, `stuck: ${r.stuckReason ?? 'unknown'}`).toBe(true)
      expect(r.hops, 'exceeded max hops').toBeLessThanOrEqual(MAX_HOPS)
    })
  }

  afterAll(() => {
    const summary = renderSummary(results)
    console.log('\n' + summary)
    try {
      mkdirSync('.algo-results', { recursive: true })
      writeFileSync('.algo-results/latest.txt', summary + '\n')
    } catch {
      // best-effort
    }
  })
})
