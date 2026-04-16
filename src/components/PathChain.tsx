import { articleUrl } from '../lib/wiki'
import type { VisitedStep } from '../lib/solver'

interface Props {
  path: VisitedStep[]
  currentIndex: number
  found: boolean
  targetTitle: string
}

export function PathChain({ path, currentIndex, found, targetTitle }: Props) {
  if (path.length === 0) return null
  return (
    <div className="relative">
      <div className="flex flex-nowrap items-stretch">

        {path.map((step, i) => {
          const isStart = i === 0
          const isCurrent = i === currentIndex && !found
          const isGoal = found && i === path.length - 1
          return (
            <div key={`${step.title}-${i}`} className="flex items-stretch">
              <NodeCard
                step={step}
                isStart={isStart}
                isCurrent={isCurrent}
                isGoal={isGoal}
                target={targetTitle}
              />
              {i < path.length - 1 && <Arrow />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NodeCard({
  step,
  isStart,
  isCurrent,
  isGoal,
  target,
}: {
  step: VisitedStep
  isStart: boolean
  isCurrent: boolean
  isGoal: boolean
  target: string
}) {
  const tone = isGoal
    ? 'border-emerald-400/50 shadow-emerald-400/20 bg-emerald-500/5'
    : isStart
      ? 'border-accent-500/50 shadow-accent-500/20 bg-accent-500/5'
      : isCurrent
        ? 'border-violet-400/60 shadow-violet-400/30 bg-violet-500/10 animate-[pulse_1.4s_ease-in-out_infinite]'
        : 'border-ink-700 bg-ink-900/70'

  const badge = isGoal ? 'GOAL' : isStart ? 'START' : `HOP ${step.index}`
  const badgeTone = isGoal
    ? 'bg-emerald-500/20 text-emerald-200'
    : isStart
      ? 'bg-accent-500/20 text-accent-400'
      : 'bg-ink-800 text-slate-400'

  return (
    <article
      className={`relative flex w-[260px] shrink-0 flex-col gap-2 rounded-xl border p-3.5 shadow-lg backdrop-blur-sm transition-all ${tone}`}
    >
      <div className="flex items-center justify-between">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ${badgeTone}`}>
          {badge}
        </span>
        {!isStart && !isGoal && (
          <span className="font-mono text-xs text-slate-400">
            {(step.similarity * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <h3 className="line-clamp-2 text-sm font-semibold text-slate-100">{step.title}</h3>
      <p className="line-clamp-3 min-h-[3rem] text-xs leading-snug text-slate-400">
        {step.intro || 'No extract available.'}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-[10px] text-slate-500">
          {step.outgoingLinks > 0 ? `${step.outgoingLinks} links` : '—'}
        </span>
        <a
          href={articleUrl(step.title)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800/80 px-2 py-1 text-[11px] font-medium text-accent-400 transition-colors hover:border-accent-500/60 hover:text-accent-400"
          aria-label={`Open ${step.title} on Wikipedia`}
        >
          Wikipedia
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M14 3h7v7M10 14L21 3M21 14v7H3V3h7" />
          </svg>
        </a>
      </div>
      {isGoal && target !== step.title && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-100">
          Found
        </div>
      )}
    </article>
  )
}

function Arrow() {
  return (
    <div className="flex items-center self-stretch px-2" aria-hidden="true">
      <svg width="34" height="18" viewBox="0 0 34 18" fill="none">
        <defs>
          <linearGradient id="arrowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <line x1="2" y1="9" x2="28" y2="9" stroke="url(#arrowGrad)" strokeWidth="2" />
        <path d="M24 4 L32 9 L24 14" fill="none" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
