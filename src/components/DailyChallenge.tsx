import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getDailyChallenge,
  getSavedResult,
  saveDailyResult,
  getDailyStats,
  buildShareText,
  todayLocal,
  type DailyChallenge as DailyChallengeType,
  type DailyResult,
  type DailyStats,
} from '../lib/daily'
import { solve, type VisitedStep, type TopCandidate } from '../lib/solver'
import { PathChain } from './PathChain'

interface LogEntry {
  time: number
  message: string
  kind: 'info' | 'warn' | 'error'
  topCandidates?: TopCandidate[]
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    easy: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    medium: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    hard: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
  }
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${colors[difficulty] ?? colors.medium}`}>
      {difficulty}
    </span>
  )
}

function StatsPanel({ stats }: { stats: DailyStats }) {
  const maxCount = Math.max(1, ...Object.values(stats.hopDistribution))
  const hops = Object.keys(stats.hopDistribution).map(Number).sort((a, b) => a - b)
  const avgHops = stats.gamesPlayed > 0 ? (stats.totalHops / stats.gamesPlayed).toFixed(1) : '--'
  const avgTime = stats.gamesPlayed > 0
    ? `${(stats.totalTime / stats.gamesPlayed).toFixed(0)}s`
    : '--'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Played', value: stats.gamesPlayed },
          { label: 'Streak', value: stats.currentStreak },
          { label: 'Max Streak', value: stats.maxStreak },
          { label: 'Avg Hops', value: avgHops },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface/50 px-2 py-2">
            <div className="text-lg font-bold text-text">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wide text-text-dim">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-text-dim">Avg time: {avgTime}</div>
      {hops.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-dim">Hop Distribution</div>
          {hops.map((h) => {
            const count = stats.hopDistribution[h]
            const pct = (count / maxCount) * 100
            return (
              <div key={h} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-right font-mono text-text-dim">{h}</span>
                <div className="flex-1">
                  <div
                    className="rounded-sm bg-accent/60 px-1.5 py-0.5 text-right font-mono text-[10px] text-bg"
                    style={{ width: `${Math.max(pct, 8)}%` }}
                  >
                    {count}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function DailyChallenge() {
  const [challenge] = useState<DailyChallengeType>(() => getDailyChallenge())
  const [savedResult, setSavedResult] = useState<DailyResult | null>(() => getSavedResult(todayLocal()))
  const [stats, setStats] = useState<DailyStats>(() => getDailyStats())
  const [showStats, setShowStats] = useState(false)

  // Solver state
  const [running, setRunning] = useState(false)
  const [path, setPath] = useState<VisitedStep[]>([])
  const [found, setFound] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [log, setLog] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const startTsRef = useRef(0)
  const tickTimerRef = useRef<number | null>(null)

  const startElapsed = () => {
    startTsRef.current = performance.now()
    setElapsed(0)
    if (tickTimerRef.current) window.clearInterval(tickTimerRef.current)
    tickTimerRef.current = window.setInterval(() => {
      setElapsed((performance.now() - startTsRef.current) / 1000)
    }, 100)
  }
  const stopElapsed = () => {
    if (tickTimerRef.current) {
      window.clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
    setElapsed((performance.now() - startTsRef.current) / 1000)
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (tickTimerRef.current) window.clearInterval(tickTimerRef.current)
    }
  }, [])

  const run = useCallback(async () => {
    if (savedResult?.completed) return
    setPath([])
    setFound(false)
    setStatus('')
    setError(null)
    setLog([])
    setRunning(true)
    startElapsed()
    const c = new AbortController()
    abortRef.current = c

    const pathTitles: string[] = [challenge.start]
    let lastAttempt: VisitedStep[] = []

    try {
      for await (const ev of solve({ start: challenge.start, end: challenge.end, maxAttempts: 3, signal: c.signal })) {
        if (c.signal.aborted) break
        if (ev.type === 'status') {
          setStatus(ev.message)
          setLog((l) => [...l, { time: performance.now(), message: ev.message, kind: 'info' }])
        } else if (ev.type === 'step') {
          setPath((p) => [...p, ev.step])
          pathTitles.push(ev.step.title)
          setLog((l) => [
            ...l,
            {
              time: performance.now(),
              message: `-> ${ev.step.title}  (${(ev.step.similarity * 100).toFixed(2)}%)`,
              kind: 'info',
              topCandidates: ev.topCandidates,
            },
          ])
        } else if (ev.type === 'found') {
          setPath((p) => [...p, ev.step])
          pathTitles.push(ev.step.title)
          setFound(true)
          setStatus(`Found "${ev.step.title}"!`)
          stopElapsed()
          const finalElapsed = (performance.now() - startTsRef.current) / 1000
          const result: DailyResult = {
            challengeNumber: challenge.challengeNumber,
            date: challenge.date,
            hops: pathTitles.length - 1,
            timeSeconds: Math.round(finalElapsed),
            path: pathTitles,
            completed: true,
          }
          saveDailyResult(result)
          setSavedResult(result)
          setStats(getDailyStats())
        } else if (ev.type === 'stuck') {
          setError(ev.reason)
          setStatus('')
          setPath((p) => (p.length > 0 ? p : lastAttempt))
          setLog((l) => [...l, { time: performance.now(), message: ev.reason, kind: 'warn' }])
        } else if (ev.type === 'restart') {
          setPath((p) => {
            lastAttempt = p
            return []
          })
          // Reset path tracking for the new attempt
          pathTitles.length = 0
          pathTitles.push(challenge.start)
          const msg = `Retrying with a different route (attempt ${ev.attempt + 1})`
          setStatus(msg)
          setLog((l) => [...l, { time: performance.now(), message: msg, kind: 'warn' }])
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        setError((e as Error)?.message ?? 'Unknown error')
      }
    } finally {
      setRunning(false)
      stopElapsed()
    }
  }, [challenge, savedResult])

  const stop = () => {
    abortRef.current?.abort()
    setRunning(false)
    stopElapsed()
    setStatus('Stopped.')
  }

  const copyResult = async () => {
    if (!savedResult) return
    const text = buildShareText(savedResult, challenge)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatTime = (s: number) => {
    if (s < 60) return `${s.toFixed(1)}s`
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const currentIndex = path.length - 1
  const isCompleted = !!savedResult?.completed

  return (
    <div className="space-y-5">
      {/* Challenge header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-text-dim">
              Daily Challenge #{challenge.challengeNumber}
            </span>
            <DifficultyBadge difficulty={challenge.difficulty} />
          </div>
          <div className="mt-2 flex items-center gap-3 text-xl font-bold text-text sm:text-2xl">
            <span>{challenge.start}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 text-accent">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span>{challenge.end}</span>
          </div>
        </div>
        <button
          onClick={() => setShowStats((v) => !v)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-hover"
        >
          {showStats ? 'Hide Stats' : 'Stats'}
        </button>
      </div>

      {showStats && (
        <div className="rounded-xl border border-border bg-surface/50 p-4">
          <StatsPanel stats={stats} />
        </div>
      )}

      {/* Completed result card */}
      {isCompleted && savedResult && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-emerald-300">Solved!</div>
              <div className="mt-1 font-mono text-lg text-text">
                {savedResult.hops} hops in {formatTime(savedResult.timeSeconds)}
              </div>
              <div className="mt-1 text-lg">
                {Array(savedResult.hops).fill(null).map((_, i) => (
                  <span key={i}>{'\u{1f7e9}'}</span>
                ))}
              </div>
            </div>
            <button
              onClick={copyResult}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-md shadow-accent/30 transition-all hover:bg-accent-hover"
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Copy Result
                </>
              )}
            </button>
          </div>
          <div className="mt-3 rounded-md border border-border bg-bg/50 p-3 font-mono text-xs text-text-muted whitespace-pre-line">
            {buildShareText(savedResult, challenge)}
          </div>
        </div>
      )}

      {/* Controls */}
      {!isCompleted && (
        <div className="flex flex-wrap items-center gap-3">
          {!running ? (
            <button
              onClick={run}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg shadow-md shadow-accent/30 transition-all hover:bg-accent-hover"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Solve Today's Challenge
            </button>
          ) : (
            <button
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-600"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z" /></svg>
              Stop
            </button>
          )}

          <div
            className={`flex min-w-[6rem] items-center justify-center rounded-lg border px-3 py-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight ${
              running
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border bg-surface text-text-muted'
            }`}
          >
            {elapsed > 0 ? formatTime(elapsed) : '--'}
          </div>

          {path.length > 0 && (
            <span className="font-mono text-sm text-text-muted">
              {Math.max(0, path.length - 1)} hops
            </span>
          )}
        </div>
      )}

      {status && (
        <p className={`truncate text-sm ${found ? 'text-emerald-300' : running ? 'text-text' : 'text-text-muted'}`}>
          {running && <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />}
          {status}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {/* Path visualization */}
      <section className="min-h-[180px] overflow-x-auto rounded-2xl border border-border bg-surface/40 p-3 sm:p-6">
        {path.length === 0 ? (
          <div className="flex min-h-[140px] items-center justify-center text-sm text-text-dim">
            {running ? 'Warming up...' : isCompleted ? 'Challenge completed!' : 'Hit "Solve" to watch the solver find a path.'}
          </div>
        ) : (
          <PathChain
            path={path}
            currentIndex={currentIndex}
            found={found}
            targetTitle={challenge.end}
          />
        )}
      </section>

      {/* Trace log */}
      {log.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface/40 p-4">
          <button
            onClick={() => setLogOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-semibold text-text">
              Trace log <span className="text-text-dim">({log.length} events)</span>
            </span>
            <span className="text-xs text-text-dim">{logOpen ? 'Hide' : 'Show'}</span>
          </button>
          {logOpen && (
            <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto font-mono text-xs text-text-muted">
              {log.map((entry, i) => (
                <li key={i} className={entry.kind === 'warn' ? 'text-amber-300' : ''}>
                  <span className="text-text-dim">
                    [{((entry.time - (log[0]?.time ?? entry.time)) / 1000).toFixed(2)}s]
                  </span>{' '}
                  {entry.message}
                  {entry.topCandidates && entry.topCandidates.length > 1 && (
                    <div className="ml-4 mt-0.5 break-words text-text-dim">
                      Top scores:{' '}
                      {entry.topCandidates
                        .map((c) => `${c.title} ${(c.score * 100).toFixed(1)}%`)
                        .join('  .  ')}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
