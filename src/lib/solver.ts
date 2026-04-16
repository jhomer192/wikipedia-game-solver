import { getIntro, getIntrosBatch, getLinks } from './wiki'
import { scoreCandidates } from './tfidf'

export interface VisitedStep {
  index: number
  title: string
  intro: string
  similarity: number
  outgoingLinks: number
}

export interface TopCandidate {
  title: string
  score: number
}

export type SolverEvent =
  | { type: 'status'; message: string }
  | { type: 'step'; step: VisitedStep; topCandidates: TopCandidate[] }
  | { type: 'found'; step: VisitedStep }
  | { type: 'stuck'; reason: string }
  | { type: 'stats'; apiCalls: number; candidatesScored: number }

export interface SolverOptions {
  start: string
  end: string
  maxHops?: number
  maxCandidatesPerStep?: number
  signal?: AbortSignal
}

export async function* solve(
  opts: SolverOptions,
): AsyncGenerator<SolverEvent, void, undefined> {
  const { start, end, maxHops = 50, maxCandidatesPerStep = 40, signal } = opts

  let apiCalls = 0
  let candidatesScored = 0
  const visited = new Set<string>()

  yield { type: 'status', message: `Fetching target article "${end}"` }
  const endIntro = await getIntro(end, signal)
  apiCalls += 1
  if (!endIntro) {
    yield { type: 'stuck', reason: `Could not load target article "${end}".` }
    return
  }

  yield { type: 'status', message: `Starting at "${start}"` }
  const startIntro = await getIntro(start, signal)
  apiCalls += 1
  if (!startIntro) {
    yield { type: 'stuck', reason: `Could not load start article "${start}".` }
    return
  }

  visited.add(start)

  const startLinks = await getLinks(start, 500, signal)
  apiCalls += 1

  const startStep: VisitedStep = {
    index: 0,
    title: start,
    intro: startIntro,
    similarity: 1,
    outgoingLinks: startLinks.length,
  }
  yield { type: 'step', step: startStep, topCandidates: [] }
  yield { type: 'stats', apiCalls, candidatesScored }

  let currentTitle = start
  let currentLinks = startLinks
  let hops = 0

  while (currentTitle !== end && hops < maxHops) {
    if (signal?.aborted) return
    hops += 1

    if (currentLinks.includes(end)) {
      const finalIntro = await getIntro(end, signal)
      apiCalls += 1
      const finalStep: VisitedStep = {
        index: hops,
        title: end,
        intro: finalIntro || endIntro,
        similarity: 1,
        outgoingLinks: 0,
      }
      visited.add(end)
      yield { type: 'found', step: finalStep }
      yield { type: 'stats', apiCalls, candidatesScored }
      return
    }

    const candidates = currentLinks
      .filter((l) => !visited.has(l))
      .slice(0, maxCandidatesPerStep)

    if (candidates.length === 0) {
      yield { type: 'stuck', reason: `No unvisited links from "${currentTitle}".` }
      return
    }

    yield {
      type: 'status',
      message: `Scoring ${candidates.length} candidates from "${currentTitle}"`,
    }

    const introMap = await getIntrosBatch(candidates, signal)
    apiCalls += Math.ceil(candidates.length / 20)

    const texts = candidates.map((c) => introMap.get(c) ?? '')
    const scores = scoreCandidates(texts, endIntro)
    candidatesScored += candidates.length

    const scored = candidates
      .map((title, i) => ({ title, score: scores[i] }))
      .sort((a, b) => b.score - a.score)

    const top5 = scored.slice(0, 5)
    const best = scored[0]

    if (!best || best.score < 0.005) {
      yield {
        type: 'stuck',
        reason: `All candidate similarities near zero — the graph is too sparse here.`,
      }
      return
    }

    visited.add(best.title)
    currentTitle = best.title

    const nextLinks = await getLinks(best.title, 500, signal)
    apiCalls += 1

    const step: VisitedStep = {
      index: hops,
      title: best.title,
      intro: introMap.get(best.title) ?? '',
      similarity: best.score,
      outgoingLinks: nextLinks.length,
    }

    currentLinks = nextLinks

    yield { type: 'step', step, topCandidates: top5 }
    yield { type: 'stats', apiCalls, candidatesScored }
  }

  if (currentTitle !== end) {
    yield { type: 'stuck', reason: `Hit max hop limit of ${maxHops} without finding "${end}".` }
  }
}
