import { useCallback, useEffect, useRef, useState } from 'react'
import { Autocomplete } from './components/Autocomplete'
import { PathChain } from './components/PathChain'
import { solve, type VisitedStep, type TopCandidate } from './lib/solver'

interface LogEntry {
  time: number
  message: string
  kind: 'info' | 'warn' | 'error'
  topCandidates?: TopCandidate[]
}

export default function App() {
  const [start, setStart] = useState('Dog')
  const [end, setEnd] = useState('Albert Einstein')
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
      for await (const ev of solve({ start: start.trim(), end: end.trim(), signal: c.signal })) {
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
              message: `→ ${ev.step.title}  (${(ev.step.similarity * 100).toFixed(2)}%)`,
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
          setLog((l) => [...l, { time: performance.now(), message: ev.reason, kind: 'warn' }])
        } else if (ev.type === 'stats') {
          setApiCalls(ev.apiCalls)
          setCandidatesScored(ev.candidatesScored)
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
  }, [start, end])

  const stop = () => {
    abortRef.current?.abort()
    setRunning(false)
    stopElapsed()
    setStatus('Stopped.')
  }

  const currentIndex = path.length - 1

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 px-3 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="bg-gradient-to-r from-sky-300 via-cyan-200 to-violet-300 bg-clip-text font-display text-2xl font-bold tracking-tight text-transparent sm:text-4xl">
              Wikipedia Game Solver
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Pick any two Wikipedia articles. A TF-IDF + cosine-similarity greedy walk hops
              from start to end using only article links.
            </p>
          </div>
          <a
            href="https://github.com/jhomer192/wikipedia-game-solver"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-accent-500/60 hover:text-accent-400"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.98 3.23 9.2 7.71 10.7.56.1.76-.24.76-.54v-2.1c-3.14.68-3.8-1.35-3.8-1.35-.52-1.3-1.27-1.65-1.27-1.65-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.68 1.25 3.34.96.1-.75.4-1.25.73-1.54-2.5-.29-5.14-1.25-5.14-5.57 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.42.11-2.97 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.63 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.69.11 2.97.72.79 1.16 1.79 1.16 3.02 0 4.33-2.64 5.28-5.16 5.56.41.35.77 1.03.77 2.08v3.08c0 .3.2.65.77.54 4.48-1.5 7.7-5.72 7.7-10.7C23.25 5.48 18.27.5 12 .5z" />
            </svg>
            GitHub
          </a>
        </div>
      </header>

      <section className="rounded-2xl border border-ink-700 bg-ink-900/50 p-4 shadow-glow backdrop-blur-sm sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Autocomplete
            id="start-article"
            label="Start article"
            placeholder="e.g. Dog"
            value={start}
            onChange={setStart}
          />
          <Autocomplete
            id="end-article"
            label="End article"
            placeholder="e.g. Albert Einstein"
            value={end}
            onChange={setEnd}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!running ? (
            <button
              onClick={run}
              disabled={!start || !end}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-ink-950 shadow-md shadow-accent-500/30 transition-all hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="ml-auto grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-400 sm:flex sm:flex-wrap sm:items-center">
            <Stat label="Hops" value={Math.max(0, path.length - 1).toString()} />
            <Stat label="API calls" value={apiCalls.toString()} />
            <Stat label="Scored" value={candidatesScored.toString()} />
            <Stat label="Elapsed" value={`${elapsed.toFixed(1)}s`} />
          </div>
        </div>

        {status && (
          <p
            className={`mt-3 truncate text-sm ${
              found ? 'text-emerald-300' : running ? 'text-slate-300' : 'text-slate-400'
            }`}
          >
            {running && (
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent-500" />
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

      <section className="min-h-[220px] overflow-x-auto rounded-2xl border border-ink-700 bg-ink-900/40 p-3 sm:p-6">
        {path.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-sm text-slate-500">
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

      <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-4 sm:p-6">
        <button
          onClick={() => setLogOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-semibold text-slate-200">
            Trace log <span className="text-slate-500">({log.length} events)</span>
          </span>
          <span className="text-xs text-slate-500">{logOpen ? 'Hide' : 'Show'}</span>
        </button>
        {logOpen && (
          <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto font-mono text-xs text-slate-400">
            {log.map((entry, i) => (
              <li key={i} className={entry.kind === 'warn' ? 'text-amber-300' : ''}>
                <span className="text-slate-600">
                  [{((entry.time - (log[0]?.time ?? entry.time)) / 1000).toFixed(2)}s]
                </span>{' '}
                {entry.message}
                {entry.topCandidates && entry.topCandidates.length > 1 && (
                  <div className="ml-4 mt-0.5 break-words text-slate-500">
                    Top scores:{' '}
                    {entry.topCandidates
                      .map((c) => `${c.title} ${(c.score * 100).toFixed(1)}%`)
                      .join('  ·  ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">How the solver works</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          At every step the solver grabs the current article&apos;s outgoing links, fetches a short
          intro extract for each candidate (batched via MediaWiki&apos;s <code className="text-slate-300">prop=extracts</code>),
          and builds TF-IDF vectors from the candidate intros plus the target&apos;s intro. It scores
          each candidate by cosine similarity to the target and greedily walks to the best unvisited
          one. Ported from the{' '}
          <a
            href="https://github.com/jhomer192/WikipediaGame"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-400 hover:underline"
          >
            Python original
          </a>
          .
        </p>
      </section>

      <footer className="mt-2 text-center text-xs text-slate-500">
        Built by{' '}
        <a
          href="https://github.com/jhomer192"
          className="text-accent-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Jack Homer
        </a>{' '}
        · data from the public MediaWiki API · no backend, no key
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800/70 px-2 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </span>
  )
}
