# Wikipedia Game Solver

Live: <https://jhomer192.github.io/wikipedia-game-solver/>

A browser app that plays the Wikipedia Game: given a start article and a goal
article, it follows the hyperlinks inside each article, using TF-IDF + cosine
similarity to pick the most semantically relevant link at every step.

Ported to TypeScript from the original Python implementation at
<https://github.com/jhomer192/WikipediaGame>.

## How it works

At each hop the solver:

1. Fetches the outgoing links of the current article via the MediaWiki `links`
   API (main namespace only).
2. If the target appears among those links, takes it and ends.
3. Otherwise batch-fetches the intro extract of up to 40 candidate links.
4. Builds TF-IDF vectors over `[candidate intros..., target intro]` and scores
   each candidate by cosine similarity against the target.
5. Jumps to the highest-scoring unvisited candidate and repeats.

Safety caps: max 30 hops, candidates per step capped at 40, aborts if the top
candidate scores below 0.05 (no semantic connection), and will not revisit
pages. It is a **greedy walker**, so the path found is not guaranteed to be
the shortest.

## MediaWiki API

All requests hit `https://en.wikipedia.org/w/api.php` with `origin=*` for CORS.
No API key is required. See `src/lib/wiki.ts`.

## Local development

```bash
npm install
npm run dev -- --port 5175 --host
```

```bash
npm run build     # tsc -b && vite build (strict)
npm run preview   # serve dist/ locally
npm run deploy    # build and push dist/ to the gh-pages branch
```

## Project layout

- `src/lib/tfidf.ts` – tokenizer, TF-IDF, sparse cosine similarity
- `src/lib/wiki.ts` – MediaWiki API wrappers (search, links, intro extracts)
- `src/lib/solver.ts` – async-generator greedy walker that yields events
- `src/components/SearchInput.tsx` – debounced autocomplete search box
- `src/components/PathGraph.tsx` – chain-of-cards path visualization
- `src/App.tsx` – UI orchestrator

## Known limitations

- Disambiguation pages are not handled specially; a hop through one can waste
  a step.
- Some very short stub articles produce near-zero TF-IDF scores and may trip
  the minimum-score abort.
- The walker is greedy: a short BFS would find shorter paths but cost far more
  API requests and would feel less interactive.
