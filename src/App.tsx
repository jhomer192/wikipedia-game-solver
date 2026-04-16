import { useCallback, useEffect, useRef, useState } from 'react'
import { Autocomplete } from './components/Autocomplete'
import { PathChain } from './components/PathChain'
import { solve, type VisitedStep, type TopCandidate } from './lib/solver'
import { getRandomArticle } from './lib/wiki'

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
        } else if (ev.type === 'restart') {
          setPath([])
          const msg = `Retrying from "${start.trim()}" with a different route (attempt ${ev.attempt + 1})`
          setStatus(msg)
          setLog((l) => [...l, { time: performance.now(), message: msg, kind: 'warn' }])
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

  const pickRandom = async (which: 'start' | 'end') => {
    const title = await getRandomArticle()
    if (title) {
      if (which === 'start') setStart(title)
      else setEnd(title)
    }
  }

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
              Pick any two Wikipedia articles. A Term Frequency – Inverse Document Frequency
              (TF-IDF) + cosine-similarity greedy walk hops from start to end using only article
              links — the classic{' '}
              <a
                href="https://en.wikipedia.org/wiki/Wikipedia:Wiki_Game"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-400 hover:underline"
              >
                Wikipedia Game
              </a>
              .
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-ink-700 bg-ink-900/50 p-4 shadow-glow backdrop-blur-sm sm:p-6">
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
              className="mb-0.5 flex-shrink-0 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-2 text-base leading-none text-slate-300 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="mb-0.5 flex-shrink-0 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-2 text-base leading-none text-slate-300 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
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
          and builds TF-IDF vectors from the candidate intros plus the target&apos;s intro. It
          scores each candidate by cosine similarity to the target and greedily walks to the best
          unvisited one. Ported from an old personal Python project.
        </p>
      </section>

      <footer className="mt-2 text-center text-xs text-slate-500">
        Built by Jack Homer · data from the public MediaWiki API · no backend, no key
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
