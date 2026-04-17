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

  // Group path indices into rows of 3 for desktop
  const rows: number[][] = []
  for (let i = 0; i < path.length; i += 3) {
    const row: number[] = []
    for (let j = i; j < i + 3 && j < path.length; j++) row.push(j)
    rows.push(row)
  }

  return (
    <div className="relative">
      {/* Mobile: flat vertical list */}
      <div className="flex flex-col items-center sm:hidden">
        {path.map((step, i) => {
          const isStart = i === 0
          const isCurrent = i === currentIndex && !found
          const isGoal = found && i === path.length - 1
          return (
            <div key={`${step.title}-${i}`} className="flex w-full flex-col items-center">
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

      {/* Desktop: 3-per-row grid, each row is a horizontal flex */}
      <div className="hidden sm:flex sm:flex-col sm:items-start sm:gap-4">
        {rows.map((rowIndices, rowIdx) => (
          <div key={rowIdx} className="flex flex-row items-stretch">
            {rowIndices.map((i, posInRow) => {
              const step = path[i]
              const isStart = i === 0
              const isCurrent = i === currentIndex && !found
              const isGoal = found && i === path.length - 1
              const isLastInPath = i === path.length - 1
              const isLastInRow = posInRow === rowIndices.length - 1
              return (
                <div key={`${step.title}-${i}`} className="flex flex-row items-stretch">
                  <NodeCard
                    step={step}
                    isStart={isStart}
                    isCurrent={isCurrent}
                    isGoal={isGoal}
                    target={targetTitle}
                  />
                  {/* Arrow after node: show between nodes in same row, suppress after last node */}
                  {!isLastInPath && !isLastInRow && <Arrow horizontal />}
                  {/* Down-arrow at end of a full row (not the final row) */}
                  {!isLastInPath && isLastInRow && rowIndices.length === 3 && (
                    <DownArrow />
                  )}
                </div>
              )
            })}
          </div>
        ))}
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
      ? 'border-accent/50 shadow-accent/20 bg-accent/5'
      : isCurrent
        ? 'border-violet-400/60 shadow-violet-400/30 bg-violet-500/10 animate-[pulse_1.4s_ease-in-out_infinite]'
        : 'border-border bg-surface/70'

  const badge = isGoal ? 'GOAL' : isStart ? 'START' : `HOP ${step.index}`
  const badgeTone = isGoal
    ? 'bg-emerald-500/20 text-emerald-200'
    : isStart
      ? 'bg-accent/20 text-accent'
      : 'bg-surface text-text-muted'

  return (
    <article
      className={`relative flex w-full max-w-sm shrink-0 flex-col gap-2 rounded-xl border p-3.5 shadow-lg backdrop-blur-sm transition-all sm:w-[260px] sm:max-w-none ${tone}`}
    >
      <div className="flex items-center justify-between">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ${badgeTone}`}>
          {badge}
        </span>
        {!isStart && !isGoal && (
          <span className="font-mono text-xs text-text-muted">
            {(step.similarity * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <h3 className="line-clamp-2 text-sm font-semibold text-text">{step.title}</h3>
      <p className="line-clamp-3 min-h-[3rem] text-xs leading-snug text-text-muted">
        {step.intro || 'No extract available.'}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-[10px] text-text-dim">
          {step.outgoingLinks > 0 ? `${step.outgoingLinks} links` : '--'}
        </span>
        <a
          href={articleUrl(step.title)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface/80 px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:border-accent/60 hover:text-accent-hover"
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

function Arrow({ horizontal = false }: { horizontal?: boolean }) {
  if (horizontal) {
    // Desktop horizontal arrow (used inside desktop rows)
    return (
      <div className="flex items-center justify-center self-stretch px-2" aria-hidden="true">
        <svg width="34" height="18" viewBox="0 0 34 18" fill="none">
          <defs>
            <linearGradient id="arrowGradH" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--border-strong)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          <line x1="2" y1="9" x2="28" y2="9" stroke="url(#arrowGradH)" strokeWidth="2" />
          <path d="M24 4 L32 9 L24 14" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  // Mobile vertical arrow
  return (
    <div className="flex items-center justify-center py-2" aria-hidden="true">
      <svg width="18" height="34" viewBox="0 0 18 34" fill="none">
        <defs>
          <linearGradient id="arrowGradV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--border-strong)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <line x1="9" y1="2" x2="9" y2="28" stroke="url(#arrowGradV)" strokeWidth="2" />
        <path d="M4 24 L9 32 L14 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function DownArrow() {
  return (
    <div className="flex items-center justify-center self-stretch px-2" aria-hidden="true">
      <svg width="18" height="34" viewBox="0 0 18 34" fill="none">
        <defs>
          <linearGradient id="arrowGradDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--border-strong)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <line x1="9" y1="2" x2="9" y2="28" stroke="url(#arrowGradDown)" strokeWidth="2" />
        <path d="M4 24 L9 32 L14 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
