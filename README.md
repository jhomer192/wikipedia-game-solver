# Wikipedia Game Solver

Give it two Wikipedia articles and it finds a path between them using only the hyperlinks inside each page — the Wikipedia game, or wikiracing, played by a program. It runs entirely in the browser against the public MediaWiki API, with no backend and no API key.

[Try it](https://jackhomer.com/wikipedia-game-solver/).

![The solver on a daily challenge, having found Insulin to Diabetes in two hops](https://jackhomer.com/screenshots/wikipedia-game-solver.webp)

## Two modes

### Greedy

The default, and the fast one. At each article it fetches the outgoing links, batch-pulls a short intro extract for up to 40 candidates, builds TF-IDF vectors over those intros plus the target's intro, and walks to whichever candidate has the highest cosine similarity to the target. Candidates get extra weight for sharing words with the target's title, and, when the target is obscure enough that every cosine score is near zero, for being a large hub article likely to bridge between subjects. If a candidate happens to be a page that already links to the target, it takes that shortcut without scoring anything.

A greedy walk wanders. When the top few scores are flat, or when it notices it's bouncing between year-variants of one title (1994 in film, then 1995 in film), it penalises anything sharing words with the last few hops and jumps elsewhere. On a dead end it restarts from a different first link, three attempts by default, keeping the visited set so each retry is pushed down a new route. It gives up at 50 hops. None of this makes the path shortest, and it doesn't claim to be.

### Shortest

A bidirectional breadth-first search instead: outgoing links forward from the start, backlinks backward from the end, one level at a time, always expanding the smaller frontier, stopping when the two meet. What it returns really is the shortest path, provided one exists inside the depth cap (2 to 6 hops, default 4). Wikipedia's link graph is big enough that this costs a lot of API calls, so each level's frontier is capped at 600 nodes.

## What you see while it runs

A live count of hops, API calls and candidates scored. A chain of cards for the path so far, each showing the article's intro, its outgoing link count, and its similarity score. And a trace log of every status message plus the top-scoring candidates considered at each step, which is the part worth reading when it makes a strange jump.

There's also a daily challenge: 368 curated article pairs, one per day, graded easy, medium or hard. Solving one records hops and time, and the app keeps a streak, an average, and a histogram of hop counts, with a copyable result line.

Rate limits and flaky requests are handled. A 429 surfaces a countdown in the UI, and 5xx responses or dropped connections get one automatic retry with backoff.

## Running it locally

```bash
npm install
npm run dev
```

```bash
npm run build       # tsc -b && vite build
npm run lint
npm run preview     # serve dist/
npm run test        # vitest
npm run test:e2e    # hits the live MediaWiki API
npm run deploy      # build and push dist/ to the gh-pages branch
```

## Layout

- `src/lib/tfidf.ts` — tokenizer, TF-IDF, sparse cosine similarity
- `src/lib/wiki.ts` — MediaWiki wrappers (search, links, backlinks, intro extracts) with retry and rate-limit reporting
- `src/lib/solver.ts` — the greedy walker, an async generator that yields events
- `src/lib/bfs.ts` — bidirectional BFS
- `src/lib/daily.ts` — the daily challenge pool, saved results, stats
- `src/App.tsx` — the UI

## Known limits

Disambiguation pages get no special handling, so a hop through one wastes a step. Very short stubs produce near-zero TF-IDF scores and can trip the abort. And greedy mode is greedy: it will cheerfully return an eight-hop path when a three-hop one exists, which is what shortest mode is for.

## Stack

React 19, TypeScript, Vite, Tailwind, Vitest. Every request goes to `https://en.wikipedia.org/w/api.php` with `origin=*` for CORS.

If you'd rather play the game than watch a program play it, [wikigame](https://github.com/jhomer192/wikigame) is the human version, with a daily challenge and this solver running in the background to set your par. There's a longer write-up at [jackhomer.com/projects/wikipedia-game-solver](https://jackhomer.com/projects/wikipedia-game-solver/).
