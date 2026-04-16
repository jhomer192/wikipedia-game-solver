import { getBacklinks, getIntro, getIntrosBatch, getLinks, isMetaTitle } from './wiki'
import { scoreCandidates, tokenize } from './tfidf'

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
  titleBoostWeight?: number
  stuckTolerance?: number
  signal?: AbortSignal
}

export async function* solve(
  opts: SolverOptions,
): AsyncGenerator<SolverEvent, void, undefined> {
  const {
    start,
    end,
    maxHops = 50,
    maxCandidatesPerStep = 40,
    titleBoostWeight = 0.35,
    stuckTolerance = 2,
    signal,
  } = opts

  let apiCalls = 0
  let candidatesScored = 0
  const visited = new Set<string>()
  const stats = () => ({ type: 'stats' as const, apiCalls, candidatesScored })

  yield { type: 'status', message: `Fetching target article "${end}"` }
  const endIntro = await getIntro(end, signal)
  apiCalls += 1
  if (!endIntro) {
    yield stats()
    yield { type: 'stuck', reason: `Could not load target article "${end}".` }
    return
  }

  yield { type: 'status', message: `Starting at "${start}"` }
  const startIntro = await getIntro(start, signal)
  apiCalls += 1
  if (!startIntro) {
    yield stats()
    yield { type: 'stuck', reason: `Could not load start article "${start}".` }
    return
  }

  // Precompute target backlinks (articles that link directly to the goal).
  // Any candidate we see in this set is one hop from the goal — jump to it.
  yield { type: 'status', message: `Fetching inbound links to "${end}"` }
  const backlinksList = await getBacklinks(end, 500, signal).catch(() => [] as string[])
  apiCalls += 1
  const backlinks = new Set(backlinksList)

  const endTitleTokens = new Set(tokenize(end))

  visited.add(start)
  const startLinksRaw = await getLinks(start, 500, signal)
  apiCalls += 1
  const startLinks = startLinksRaw.filter((l) => !isMetaTitle(l))

  const startStep: VisitedStep = {
    index: 0,
    title: start,
    intro: startIntro,
    similarity: 1,
    outgoingLinks: startLinks.length,
  }
  yield { type: 'step', step: startStep, topCandidates: [] }
  yield stats()

  let currentTitle = start
  let currentLinks = startLinks
  let hops = 0
  let consecutiveWeak = 0

  const WEAK_SCORE = 0.005

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
      yield stats()
      return
    }

    // 2-hop shortcut: any unvisited candidate that also links *to* the goal
    // gets picked immediately. Next iteration will hit the direct-link branch.
    const backlinkHit = currentLinks.find((l) => !visited.has(l) && backlinks.has(l))
    if (backlinkHit) {
      visited.add(backlinkHit)
      currentTitle = backlinkHit
      const nextLinksRaw = await getLinks(backlinkHit, 500, signal)
      apiCalls += 1
      const nextLinks = nextLinksRaw.filter((l) => !isMetaTitle(l))
      const hitIntro = await getIntro(backlinkHit, signal)
      apiCalls += 1
      const step: VisitedStep = {
        index: hops,
        title: backlinkHit,
        intro: hitIntro,
        similarity: 1,
        outgoingLinks: nextLinks.length,
      }
      currentLinks = nextLinks
      yield {
        type: 'step',
        step,
        topCandidates: [{ title: backlinkHit, score: 1 }],
      }
      yield stats()
      consecutiveWeak = 0
      continue
    }

    const candidates = currentLinks
      .filter((l) => !visited.has(l))
      .slice(0, maxCandidatesPerStep)

    if (candidates.length === 0) {
      yield stats()
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
    const cosineScores = scoreCandidates(texts, endIntro)
    candidatesScored += candidates.length

    // Title-word overlap boost: favour candidates whose own title shares tokens
    // with the target title. Often decisive when the goal is a literal link.
    const boosted = candidates.map((title, i) => {
      const candTokens = new Set(tokenize(title))
      let overlap = 0
      for (const t of candTokens) if (endTitleTokens.has(t)) overlap += 1
      const denom = Math.max(endTitleTokens.size, 1)
      const boost = titleBoostWeight * (overlap / denom)
      return { title, score: cosineScores[i] + boost }
    })

    const scored = boosted.sort((a, b) => b.score - a.score)
    const top5 = scored.slice(0, 5)

    // Second chance: take the first unvisited non-weak candidate. If the top
    // candidate is weak, count it against stuckTolerance instead of bailing.
    const next = scored.find((s) => !visited.has(s.title))
    if (!next) {
      yield stats()
      yield { type: 'stuck', reason: `No unvisited candidates at "${currentTitle}".` }
      return
    }

    if (next.score < WEAK_SCORE) {
      consecutiveWeak += 1
      if (consecutiveWeak >= stuckTolerance) {
        yield stats()
        yield {
          type: 'stuck',
          reason: `All candidate similarities near zero across ${consecutiveWeak} consecutive steps.`,
        }
        return
      }
    } else {
      consecutiveWeak = 0
    }

    visited.add(next.title)
    currentTitle = next.title

    const nextLinksRaw = await getLinks(next.title, 500, signal)
    apiCalls += 1
    const nextLinks = nextLinksRaw.filter((l) => !isMetaTitle(l))

    const step: VisitedStep = {
      index: hops,
      title: next.title,
      intro: introMap.get(next.title) ?? '',
      similarity: next.score,
      outgoingLinks: nextLinks.length,
    }

    currentLinks = nextLinks

    yield { type: 'step', step, topCandidates: top5 }
    yield stats()
  }

  if (currentTitle !== end) {
    yield stats()
    yield { type: 'stuck', reason: `Hit max hop limit of ${maxHops} without finding "${end}".` }
  }
}
