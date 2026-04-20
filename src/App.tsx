import { useCallback, useEffect, useRef, useState } from 'react'
import { Autocomplete } from './components/Autocomplete'
import { DailyChallenge } from './components/DailyChallenge'
import { PathChain } from './components/PathChain'
import { ThemePicker } from './components/ThemePicker'
import { solve, type VisitedStep, type TopCandidate } from './lib/solver'
import { bfsShortestPath } from './lib/bfs'
import { getRandomArticle, subscribeRateLimit } from './lib/wiki'
import { getSavedResult, getDailyStats, todayLocal } from './lib/daily'

function formatElapsed(seconds: number, hasRun: boolean): string {
  if (!hasRun) return '--'
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(Math.floor(s)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`
  }
  return `${seconds.toFixed(1)} s`
}

interface LogEntry {
  time: number
  message: string
  kind: 'info' | 'warn' | 'error'
  topCandidates?: TopCandidate[]
}

type Tab = 'daily' | 'solver'
type SolverMode = 'greedy' | 'shortest'

export default function App() {
  const [tab, setTab] = useState<Tab>('daily')
  const [start, setStart] = useState('Dog')
  const [end, setEnd] = useState('Albert Einstein')
  const [mode, setMode] = useState<SolverMode>('greedy')
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [bfsMaxDepth, setBfsMaxDepth] = useState(4)
  const [running, setRunning] = useState(false)
  const [path, setPath] = useState<VisitedStep[]>([])
  const [found, setFound] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [apiCalls, setApiCalls] = useState(0)
  const [candidatesScored, setCandidatesScored] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [log, setLog] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState<{ retryAfter: number | null } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const startTsRef = useRef(0)
  const tickTimerRef = useRef<number | null>(null)
  const hasRunRef = useRef(false)
  const lastAttemptRef = useRef<VisitedStep[]>([])
  const rateLimitTimerRef = useRef<number | null>(null)

  const startElapsed = () => {
    hasRunRef.current = true
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

  useEffect(() => {
    const unsub = subscribeRateLimit((retryAfter) => {
      setRateLimited({ retryAfter })
      if (rateLimitTimerRef.current) window.clearTimeout(rateLimitTimerRef.current)
      const delay = (retryAfter != null && retryAfter > 0 ? retryAfter : 60) * 1000
      rateLimitTimerRef.current = window.setTimeout(() => {
        setRateLimited(null)
        rateLimitTimerRef.current = null
      }, delay)
    })
    return () => {
      unsub()
      if (rateLimitTimerRef.current) window.clearTimeout(rateLimitTimerRef.current)
    }
  }, [])

  const reset = () => {
    setPath([])
    setFound(false)
    setStatus('')
    setApiCalls(0)
    setCandidatesScored(0)
    setElapsed(0)
    setLog([])
    setError(null)
  }

  const run = useCallback(async () => {
    if (!start.trim() || !end.trim()) return
    if (start.trim() === end.trim()) {
      setError('Start and end must be different articles.')
      return
    }
    reset()
    setRunning(true)
    startElapsed()
    const c = new AbortController()
    abortRef.current = c

    try {
      if (mode === 'shortest') {
        // Bidirectional BFS path. The result is an array of page titles; we
        // convert to VisitedStep[] so the existing PathChain UI renders it.
        for await (const ev of bfsShortestPath({
          start: start.trim(),
          end: end.trim(),
          maxDepth: bfsMaxDepth,
          signal: c.signal,
        })) {
          if (c.signal.aborted) break
          if (ev.type === 'status' || ev.type === 'progress') {
            if (ev.message) {
              setStatus(ev.message)
              setLog((l) => [...l, { time: performance.now(), message: ev.message!, kind: 'info' }])
            }
          } else if (ev.type === 'stats') {
            if (ev.apiCalls != null) setApiCalls(ev.apiCalls)
            if (ev.nodesExplored != null) setCandidatesScored(ev.nodesExplored)
          } else if (ev.type === 'found' && ev.path) {
            const steps: VisitedStep[] = ev.path.map((title, i) => ({
              index: i,
              title,
              intro: '',
              similarity: 1,
              outgoingLinks: 0,
            }))
            setPath(steps)
            setFound(true)
            setStatus(`Shortest path found in ${ev.path.length - 1} hop${ev.path.length - 1 !== 1 ? 's' : ''}.`)
            setLog((l) => [...l, { time: performance.now(), message: `Reached target in ${ev.path!.length - 1} hops.`, kind: 'info' }])
          } else if (ev.type === 'not_found') {
            setError(ev.message ?? 'No path found.')
            setStatus('')
            setLog((l) => [...l, { time: performance.now(), message: ev.message ?? 'No path.', kind: 'warn' }])
          }
        }
      } else {
        for await (const ev of solve({ start: start.trim(), end: end.trim(), maxAttempts, signal: c.signal })) {
          if (c.signal.aborted) break
          if (ev.type === 'status') {
            setStatus(ev.message)
            setLog((l) => [...l, { time: performance.now(), message: ev.message, kind: 'info' }])
          } else if (ev.type === 'step') {
            setPath((p) => [...p, ev.step])
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
            setFound(true)
            setStatus(`Found "${ev.step.title}"!`)
            setLog((l) => [
              ...l,
              { time: performance.now(), message: `Reached target.`, kind: 'info' },
            ])
          } else if (ev.type === 'stuck') {
            setError(ev.reason)
            setStatus('')
            setPath((p) => {
              const best = p.length > 0 ? p : lastAttemptRef.current
              return best
            })
            setLog((l) => [...l, { time: performance.now(), message: ev.reason, kind: 'warn' }])
          } else if (ev.type === 'restart') {
            setPath((p) => {
              lastAttemptRef.current = p
              return []
            })
            const msg = `Retrying from "${start.trim()}" with a different route (attempt ${ev.attempt + 1})`
            setStatus(msg)
            setLog((l) => [...l, { time: performance.now(), message: msg, kind: 'warn' }])
          } else if (ev.type === 'stats') {
            setApiCalls(ev.apiCalls)
            setCandidatesScored(ev.candidatesScored)
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        const msg = (e as Error)?.message ?? 'Unknown error'
        setError(msg)
      }
    } finally {
      setRunning(false)
      stopElapsed()
    }
  }, [start, end, maxAttempts, mode, bfsMaxDepth])

  const pickRandom = async (which: 'start' | 'end') => {
    try {
      const title = await getRandomArticle()
      if (title) {
        if (which === 'start') setStart(title)
        else setEnd(title)
      }
    } catch {
      // network error -- user can click again
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    setRunning(false)
    stopElapsed()
    setStatus('Stopped.')
  }

  const currentIndex = path.length - 1

  const dailyResult = getSavedResult(todayLocal())
  const dailyStatsData = getDailyStats()
  const dailyCompleted = !!dailyResult?.completed

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 px-3 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight sm:text-4xl">
              <img src="/logo.svg" alt="Wikipedia Game Solver logo" className="h-8 w-8 sm:h-10 sm:w-10" />
              <span className="bg-gradient-to-r from-accent via-accent-2 to-accent-3 bg-clip-text text-transparent">
                Wikipedia Game Solver
              </span>
            </h1>
            <p className="mt-1 max-w-xl text-sm text-text-muted">
              The{' '}
              <a
                href="https://en.wikipedia.org/wiki/Wikipedia:Wiki_Game"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Wikipedia Game
              </a>
              {' '}challenges you to navigate from one article to another using only the hyperlinks
              inside each page. This tool automates that search with a text-similarity heuristic
              (TF-IDF + cosine similarity) that scores each outgoing link against the target and
              greedily follows the best one.
            </p>
          </div>
          <ThemePicker />
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-1 rounded-xl border border-border bg-surface/30 p-1">
          <button
            onClick={() => setTab('daily')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              tab === 'daily'
                ? 'bg-accent/15 text-accent shadow-sm'
                : 'text-text-muted hover:bg-surface-hover hover:text-text'
            }`}
          >
            <span className="text-base">📅</span>
            Daily Challenge
            {dailyStatsData.currentStreak > 0 && (
              <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                🔥 {dailyStatsData.currentStreak}
              </span>
            )}
            {dailyCompleted && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setTab('solver')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              tab === 'solver'
                ? 'bg-accent/15 text-accent shadow-sm'
                : 'text-text-muted hover:bg-surface-hover hover:text-text'
            }`}
          >
            <span className="text-base">🔍</span>
            Free Solver
          </button>
        </div>
      </header>

      {tab === 'daily' && (
        <section className="rounded-2xl border border-border bg-surface/50 p-4 shadow-glow backdrop-blur-sm sm:p-6">
          <DailyChallenge />
        </section>
      )}

      {tab === 'solver' && <>
      {rateLimited && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-700/50 bg-amber-900/30 px-4 py-3 text-sm text-amber-200">
          <div>
            <p className="font-semibold">Wikipedia rate-limited us. Come back later.</p>
            <p className="mt-0.5 text-amber-300/80">
              Wikipedia temporarily blocked this browser from making more API requests.
              {rateLimited.retryAfter != null ? (
                <> Try again in ~{rateLimited.retryAfter}s.</>
              ) : (
                <> Try again in a minute or two.</>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss rate-limit warning"
            onClick={() => {
              setRateLimited(null)
              if (rateLimitTimerRef.current) {
                window.clearTimeout(rateLimitTimerRef.current)
                rateLimitTimerRef.current = null
              }
            }}
            className="mt-0.5 flex-shrink-0 text-amber-400 hover:text-amber-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface/50 p-4 shadow-glow backdrop-blur-sm sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Autocomplete
                id="start-article"
                label="Start article"
                placeholder="e.g. Dog"
                value={start}
                onChange={setStart}
              />
            </div>
            <button
              type="button"
              title="Pick a random article"
              aria-label="Pick a random article"
              disabled={running}
              onClick={() => pickRandom('start')}
              className="mb-0.5 flex-shrink-0 rounded-lg border border-border bg-surface px-2.5 py-2 text-base leading-none text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              🎲
            </button>
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Autocomplete
                id="end-article"
                label="End article"
                placeholder="e.g. Albert Einstein"
                value={end}
                onChange={setEnd}
              />
            </div>
            <button
              type="button"
              title="Pick a random article"
              aria-label="Pick a random article"
              disabled={running}
              onClick={() => pickRandom('end')}
              className="mb-0.5 flex-shrink-0 rounded-lg border border-border bg-surface px-2.5 py-2 text-base leading-none text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              🎲
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!running ? (
            <button
              onClick={run}
              disabled={!start || !end}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-md shadow-accent/30 transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Solve
            </button>
          ) : (
            <button
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z" /></svg>
              Stop
            </button>
          )}

          {/* Mode toggle */}
          <div className="inline-flex items-center gap-0 overflow-hidden rounded-lg border border-border text-xs font-semibold">
            <button
              type="button"
              disabled={running}
              onClick={() => setMode('greedy')}
              title="Greedy TF-IDF walker - fast, but not guaranteed shortest"
              className={`px-3 py-1.5 transition-colors ${
                mode === 'greedy'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface text-text-muted hover:bg-surface-hover'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Greedy
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => setMode('shortest')}
              title="Bidirectional BFS - finds the true shortest path within the depth cap"
              className={`px-3 py-1.5 transition-colors ${
                mode === 'shortest'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface text-text-muted hover:bg-surface-hover'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Shortest
            </button>
          </div>

          {mode === 'greedy' ? (
            <label className="flex items-center gap-1.5 text-sm text-text-muted">
              Max retries
              <input
                type="number"
                min={1}
                max={5}
                disabled={running}
                value={maxAttempts}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v)) setMaxAttempts(Math.min(5, Math.max(1, v)))
                }}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (isNaN(v) || v < 1 || v > 5) setMaxAttempts(3)
                }}
                className="w-14 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm font-mono text-text focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
              />
            </label>
          ) : (
            <label className="flex items-center gap-1.5 text-sm text-text-muted">
              Max hops
              <input
                type="number"
                min={2}
                max={6}
                disabled={running}
                value={bfsMaxDepth}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v)) setBfsMaxDepth(Math.min(6, Math.max(2, v)))
                }}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (isNaN(v) || v < 2 || v > 6) setBfsMaxDepth(4)
                }}
                className="w-14 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm font-mono text-text focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
              />
            </label>
          )}

          <div
            className={`flex min-w-[6rem] items-center justify-center rounded-lg border px-3 py-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight ${
              running
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border bg-surface text-text-muted'
            }`}
          >
            {formatElapsed(elapsed, hasRunRef.current)}
          </div>

          <div className="ml-auto grid grid-cols-2 gap-2 font-mono text-[11px] text-text-dim sm:flex sm:flex-wrap sm:items-center">
            <Stat label="Hops" value={Math.max(0, path.length - 1).toString()} />
            <Stat label="API calls" value={apiCalls.toString()} />
            <Stat label="Scored" value={candidatesScored.toString()} />
          </div>
        </div>

        {/* Mode disclaimer */}
        <p className="mt-3 rounded-md border border-border/60 bg-surface/50 px-3 py-2 text-xs text-text-muted">
          {mode === 'greedy' ? (
            <>
              <span className="font-semibold text-text">Greedy mode:</span> a TF-IDF walker that
              follows the most semantically relevant link at each step. Fast, but the path it
              returns is <span className="font-semibold">not guaranteed to be the shortest</span>.
            </>
          ) : (
            <>
              <span className="font-semibold text-text">Shortest-path mode:</span> bidirectional BFS
              over the Wikipedia link graph. Guarantees the shortest path it finds is truly
              shortest, but is limited to the max-hops depth cap. Can be slow or rate-limited on
              popular hub pages -- try narrowing to specific starts/ends.
            </>
          )}
        </p>

        {status && (
          <p
            className={`mt-3 truncate text-sm ${
              found ? 'text-emerald-300' : running ? 'text-text' : 'text-text-muted'
            }`}
          >
            {running && (
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            )}
            {status}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </section>

      <section className="min-h-[220px] overflow-x-auto rounded-2xl border border-border bg-surface/40 p-3 sm:p-6">
        {path.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-sm text-text-dim">
            {running ? 'Warming up...' : 'The path will appear here as the solver walks.'}
          </div>
        ) : (
          <PathChain
            path={path}
            currentIndex={currentIndex}
            found={found}
            targetTitle={end.trim()}
          />
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/40 p-4 sm:p-6">
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
      </>}

      <section className="rounded-2xl border border-border bg-surface/40 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-text">How the solver works</h2>
        <div className="mt-2 max-w-3xl space-y-3 text-sm leading-relaxed text-text-muted">
          <p>
            <span className="font-semibold text-text">Greedy (default).</span> At every step the
            walker grabs the current article&apos;s outgoing links, fetches a short intro extract
            for each candidate (batched via MediaWiki&apos;s{' '}
            <code className="text-text">prop=extracts</code>), and builds TF-IDF vectors from the
            candidate intros plus the target&apos;s intro. It scores each candidate by cosine
            similarity to the target and greedily walks to the best unvisited one. Fast and cheap,
            but offers <em>no guarantee</em> that the path it returns is the shortest.
          </p>
          <p>
            <span className="font-semibold text-text">Shortest path.</span> Runs a bidirectional
            breadth-first search over the Wikipedia link graph -- expanding outgoing links forward
            from the start and backlinks backward from the end, one level at a time, until the two
            frontiers meet. The path it reports is guaranteed to be the shortest <em>within</em>{' '}
            the configured max-hops depth cap. Heavier on API calls, so rate-limit-friendly caps
            apply.
          </p>
        </div>
      </section>

      <footer className="mt-2 text-center text-xs text-text-dim">
        Built by Jack Homer · data from the public MediaWiki API · no backend, no key
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface/70 px-2 py-1">
      <span className="text-text-dim">{label}</span>
      <span className="text-text">{value}</span>
    </span>
  )
}
