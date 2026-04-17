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
  | { type: 'restart'; attempt: number }
  | { type: 'stats'; apiCalls: number; candidatesScored: number }

export interface SolverOptions {
  start: string
  end: string
  maxHops?: number
  maxCandidatesPerStep?: number
  titleBoostWeight?: number
  titleLengthBoostWeight?: number
  stuckTolerance?: number
  maxAttempts?: number
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
    titleLengthBoostWeight = 0.05,
    stuckTolerance = 2,
    maxAttempts = 3,
    signal,
  } = opts

  const FLAT_THRESHOLD = 0.01

  let apiCalls = 0
  let candidatesScored = 0
  // Visited persists across attempts so each restart is forced to diverge
  // from trajectories we already explored (and got stuck on).
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

  yield { type: 'status', message: `Fetching inbound links to "${end}"` }
  const backlinksResult = await getBacklinks(end, 500, signal).catch(() => ({ titles: [] as string[], calls: 1 }))
  apiCalls += backlinksResult.calls
  const backlinks = new Set(backlinksResult.titles)

  const endTitleTokens = new Set(tokenize(end))

  const startLinksResult = await getLinks(start, 500, signal)
  apiCalls += startLinksResult.calls
  const startLinksAll = startLinksResult.titles.filter((l) => !isMetaTitle(l))

  const WEAK_SCORE = 0.005
  let lastStuckReason = `Hit max hop limit of ${maxHops} without finding "${end}".`

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) return
    if (attempt > 0) {
      yield { type: 'restart', attempt }
    }

    const recentTitles: string[] = []
    visited.add(start)
    const initialLinks = startLinksAll.filter((l) => !visited.has(l))
    if (initialLinks.length === 0) {
      // All start links have been tried across previous attempts.
      lastStuckReason = `No fresh starting candidates left after ${attempt} attempt(s).`
      break
    }

    const startStep: VisitedStep = {
      index: 0,
      title: start,
      intro: startIntro,
      similarity: 1,
      outgoingLinks: initialLinks.length,
    }
    yield { type: 'step', step: startStep, topCandidates: [] }
    yield stats()

    let currentTitle = start
    let currentLinks = initialLinks
    let hops = 0
    let consecutiveWeak = 0
    let attemptStuckReason: string | null = null

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

      const backlinkHit = currentLinks.find((l) => !visited.has(l) && backlinks.has(l))
      if (backlinkHit) {
        visited.add(backlinkHit)
        currentTitle = backlinkHit
        const nextLinksResult = await getLinks(backlinkHit, 500, signal)
        apiCalls += nextLinksResult.calls
        const nextLinks = nextLinksResult.titles.filter((l) => !isMetaTitle(l))
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
        .filter((l) => !visited.has(l) && l.length <= 80)
        .slice(0, maxCandidatesPerStep)

      if (candidates.length === 0) {
        attemptStuckReason = `No unvisited links from "${currentTitle}".`
        break
      }

      yield {
        type: 'status',
        message: `Scoring ${candidates.length} candidates from "${currentTitle}"`,
      }

      const { intros: introMap, pageSizes } = await getIntrosBatch(candidates, signal)
      apiCalls += Math.ceil(candidates.length / 20)

      const texts = candidates.map((c) => introMap.get(c) ?? '')
      const cosineScores = scoreCandidates(texts, endIntro)
      candidatesScored += candidates.length

      const boosted = candidates.map((title, i) => {
        const candTokens = new Set(tokenize(title))
        let overlap = 0
        for (const t of candTokens) if (endTitleTokens.has(t)) overlap += 1
        const denom = Math.max(endTitleTokens.size, 1)
        const boost = titleBoostWeight * (overlap / denom)
        // Hub bias: shorter titles tend to be broader hub articles; long titles
        // are often narrow disambiguation or "2003 X season" articles.
        const lengthBias = titleLengthBoostWeight * Math.max(0, 1 - title.length / 50)
        return { title, score: cosineScores[i] + boost + lengthBias }
      })

      const scored = boosted.sort((a, b) => b.score - a.score)

      // Detect year-variant loops: "2019 X season", "2020 X season", "2018 X season"
      // Strip 4-digit years from recent titles and check if they collapse to the same string
      const stripYears = (s: string) => s.replace(/\b\d{4}\b/g, '').replace(/\s+/g, ' ').trim()
      const isYearLoop =
        recentTitles.length >= 3 &&
        new Set(recentTitles.slice(-3).map(stripYears)).size === 1

      const isFlat =
        scored.length >= 3 &&
        scored[0].score - scored[Math.min(4, scored.length - 1)].score < FLAT_THRESHOLD

      const shouldEscape = isFlat || isYearLoop

      let finalScored = scored
      if (shouldEscape) {
        const reason = isYearLoop ? 'Year-variant loop' : 'Flat scoring'
        yield { type: 'status', message: `${reason} detected at "${currentTitle}" - escaping cluster` }
        const recentWords = new Set<string>()
        for (const t of recentTitles) {
          for (const w of tokenize(t)) recentWords.add(w)
        }

        // Hard-filter: remove candidates that share 50%+ words with recent titles
        const filtered = scored.filter(({ title }) => {
          const words = tokenize(title)
          if (words.length === 0) return true
          const overlapCount = words.filter((w) => recentWords.has(w)).length
          return overlapCount / words.length < 0.5
        })

        // If hard-filter removed everything, fall back to all candidates
        const pool = filtered.length > 0 ? filtered : scored

        const escapeCandidates = pool.map(({ title, score }) => {
          const words = tokenize(title)
          const overlapCount = words.filter((w) => recentWords.has(w)).length
          const overlapRatio = words.length > 0 ? overlapCount / words.length : 0
          const noveltyPenalty = -1.5 * overlapRatio
          const hubBonus = 0.1 * Math.max(0, 1 - title.length / 40)
          // Use actual page byte size as hub signal (bigger article = more outgoing links)
          const pageSize = pageSizes.get(title) ?? 0
          // Log scale: 80KB article gets ~1.0, 250KB gets ~1.4, tiny stubs get near 0
          const pageSizeBonus = pageSize > 0 ? Math.max(0, Math.log(pageSize / 5000) / Math.log(16)) : 0
          return { title, score: score + noveltyPenalty + hubBonus + pageSizeBonus }
        })
        finalScored = escapeCandidates.sort((a, b) => b.score - a.score)
      }

      const top5 = finalScored.slice(0, 5)

      const next = finalScored.find((s) => !visited.has(s.title))
      if (!next) {
        attemptStuckReason = `No unvisited candidates at "${currentTitle}".`
        break
      }

      if (next.score < WEAK_SCORE) {
        consecutiveWeak += 1
        if (consecutiveWeak >= stuckTolerance) {
          attemptStuckReason = `All candidate similarities near zero across ${consecutiveWeak} consecutive steps.`
          break
        }
      } else {
        consecutiveWeak = 0
      }

      visited.add(next.title)
      currentTitle = next.title
      recentTitles.push(next.title)
      if (recentTitles.length > 5) recentTitles.shift()

      const nextLinksResult = await getLinks(next.title, 500, signal)
      apiCalls += nextLinksResult.calls
      const nextLinks = nextLinksResult.titles.filter((l) => !isMetaTitle(l))

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

    if (currentTitle === end) return

    lastStuckReason =
      attemptStuckReason ?? `Hit max hop limit of ${maxHops} without finding "${end}".`
  }

  yield stats()
  yield { type: 'stuck', reason: lastStuckReason }
}
