// Bidirectional breadth-first search for the Wikipedia Game.
//
// Expands a frontier forward from `start` (outgoing links) and backward from
// `end` (backlinks) one level at a time, stopping as soon as the two meet.
// Guarantees the path it returns is the shortest by hop count among the
// pages the walk actually explored.
//
// Because Wikipedia's link graph is enormous and each API call returns
// ~500 links per page, a full BFS even 3 levels deep can touch hundreds of
// thousands of nodes. To keep this practical in the browser we:
//   - cap total depth (default 4 combined levels, i.e. paths up to length 4)
//   - cap the per-level frontier size (keeps each level's API fan-out bounded)
//   - abort early on AbortSignal
//
// Short pairs (the common case) typically finish within a few seconds.

import { getLinks, getBacklinks, isMetaTitle } from './wiki'

export interface BfsEvent {
  type: 'status' | 'progress' | 'found' | 'not_found' | 'stats'
  message?: string
  path?: string[]
  apiCalls?: number
  nodesExplored?: number
  level?: number
  frontierSize?: number
}

export interface BfsOptions {
  start: string
  end: string
  /** Max total path length to search for (default 4). Paths longer than this are not found. */
  maxDepth?: number
  /** Max frontier size per side; excess nodes at a level are dropped. */
  maxFrontier?: number
  /** How many outgoing/incoming links to fetch per node. */
  linksPerNode?: number
  signal?: AbortSignal
}

interface Frontier {
  // map title -> the predecessor title that reached it (for path reconstruction)
  parents: Map<string, string | null>
  // nodes added at the most recent level; these are the ones to expand next
  newlyAdded: Set<string>
}

function reconstructPath(
  meet: string,
  fwdParents: Map<string, string | null>,
  bwdParents: Map<string, string | null>,
): string[] {
  const forward: string[] = []
  let cur: string | null | undefined = meet
  while (cur != null) {
    forward.unshift(cur)
    cur = fwdParents.get(cur) ?? null
  }
  const backward: string[] = []
  cur = bwdParents.get(meet) ?? null
  while (cur != null) {
    backward.push(cur)
    cur = bwdParents.get(cur) ?? null
  }
  return [...forward, ...backward]
}

export async function* bfsShortestPath(
  opts: BfsOptions,
): AsyncGenerator<BfsEvent, void, undefined> {
  const {
    start,
    end,
    maxDepth = 4,
    maxFrontier = 600,
    linksPerNode = 500,
    signal,
  } = opts

  let apiCalls = 0
  let nodesExplored = 0
  const stats = (): BfsEvent => ({ type: 'stats', apiCalls, nodesExplored })

  if (start === end) {
    yield { type: 'found', path: [start] }
    return
  }

  const fwd: Frontier = {
    parents: new Map([[start, null]]),
    newlyAdded: new Set([start]),
  }
  const bwd: Frontier = {
    parents: new Map([[end, null]]),
    newlyAdded: new Set([end]),
  }

  // immediate check: is `end` a direct link of `start`?
  yield { type: 'status', message: `Fetching outgoing links of "${start}"` }
  const startLinks = await getLinks(start, linksPerNode, signal)
  apiCalls += startLinks.calls
  nodesExplored += 1
  const directLinks = startLinks.titles.filter((t) => !isMetaTitle(t))
  if (directLinks.includes(end)) {
    yield { type: 'found', path: [start, end] }
    yield stats()
    return
  }
  for (const link of directLinks) {
    if (!fwd.parents.has(link)) fwd.parents.set(link, start)
  }
  fwd.newlyAdded = new Set(directLinks)

  // Check immediate meet
  for (const t of fwd.newlyAdded) {
    if (bwd.parents.has(t)) {
      yield { type: 'found', path: reconstructPath(t, fwd.parents, bwd.parents) }
      yield stats()
      return
    }
  }

  // Total depth already "consumed": 1 forward level. We'll alternate, always
  // expanding the smaller frontier to keep total work bounded.
  let totalDepth = 1
  const SIDE_CAP = Math.ceil(maxDepth / 2)

  while (totalDepth < maxDepth) {
    if (signal?.aborted) return

    // choose side to expand: smaller frontier first
    const expandForward = fwd.newlyAdded.size <= bwd.newlyAdded.size
    const side = expandForward ? fwd : bwd
    const otherSide = expandForward ? bwd : fwd
    const label = expandForward ? 'forward' : 'backward'
    const currentSideDepth = expandForward
      ? Math.ceil((totalDepth + 1) / 2)
      : Math.floor((totalDepth + 1) / 2)

    if (currentSideDepth > SIDE_CAP) {
      // this side has already been expanded as deep as allowed
      break
    }

    // cap frontier size to bound API work
    const frontier = Array.from(side.newlyAdded).slice(0, maxFrontier)
    yield {
      type: 'progress',
      message: `Exploring ${label} level ${currentSideDepth} (${frontier.length} nodes)`,
      level: totalDepth + 1,
      frontierSize: frontier.length,
    }

    const nextAdded = new Set<string>()
    // Fetch neighbors sequentially so we can abort promptly and surface progress.
    for (let i = 0; i < frontier.length; i++) {
      if (signal?.aborted) return
      const node = frontier[i]
      const res = expandForward
        ? await getLinks(node, linksPerNode, signal)
        : await getBacklinks(node, linksPerNode, signal)
      apiCalls += res.calls
      nodesExplored += 1

      for (const neighbor of res.titles) {
        if (isMetaTitle(neighbor)) continue
        if (side.parents.has(neighbor)) continue
        side.parents.set(neighbor, node)
        nextAdded.add(neighbor)

        // meet check: is this neighbor known to the other frontier?
        if (otherSide.parents.has(neighbor)) {
          // Reconstruct: forward path joins at `neighbor` via side=fwd,
          // backward path joins at `neighbor` via side=bwd.
          const path = expandForward
            ? reconstructPath(neighbor, side.parents, otherSide.parents)
            : reconstructPath(neighbor, otherSide.parents, side.parents)
          yield { type: 'found', path }
          yield stats()
          return
        }
      }

      // emit a progress tick every 10 nodes so the UI stays responsive
      if ((i + 1) % 10 === 0) {
        yield stats()
      }
    }

    side.newlyAdded = nextAdded
    totalDepth += 1

    if (nextAdded.size === 0) {
      // exhausted this side
      break
    }
  }

  yield stats()
  yield {
    type: 'not_found',
    message: `No path found within ${maxDepth} hops (searched ${nodesExplored} pages).`,
  }
}
