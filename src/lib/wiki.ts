const API = 'https://en.wikipedia.org/w/api.php'

export interface Suggestion {
  title: string
  description?: string
  url: string
}

function apiUrl(params: Record<string, string>): string {
  const qp = new URLSearchParams({ ...params, format: 'json', origin: '*' })
  return `${API}?${qp.toString()}`
}

export async function opensearch(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  if (!query.trim()) return []
  const res = await fetch(
    apiUrl({ action: 'opensearch', search: query, limit: '8', namespace: '0' }),
    { signal },
  )
  if (!res.ok) return []
  const data = (await res.json()) as [string, string[], string[], string[]]
  const [, titles, descriptions, urls] = data
  return titles.map((title, i) => ({
    title,
    description: descriptions?.[i],
    url: urls?.[i] ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  }))
}

export async function getIntro(title: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(
    apiUrl({
      action: 'query',
      titles: title,
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      redirects: '1',
    }),
    { signal },
  )
  if (!res.ok) return ''
  const data = await res.json()
  const pages = data?.query?.pages ?? {}
  const first = Object.values(pages)[0] as { extract?: string } | undefined
  return first?.extract ?? ''
}

export async function getIntrosBatch(
  titles: string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (titles.length === 0) return out
  const BATCH = 20
  for (let i = 0; i < titles.length; i += BATCH) {
    const chunk = titles.slice(i, i + BATCH)
    const res = await fetch(
      apiUrl({
        action: 'query',
        titles: chunk.join('|'),
        prop: 'extracts',
        exintro: 'true',
        explaintext: 'true',
        redirects: '1',
      }),
      { signal },
    )
    if (!res.ok) continue
    const data = await res.json()
    const normalized: { from: string; to: string }[] = data?.query?.normalized ?? []
    const normMap = new Map(normalized.map((n) => [n.to, n.from]))
    const pages = data?.query?.pages ?? {}
    for (const p of Object.values(pages) as { title?: string; extract?: string }[]) {
      if (!p.title) continue
      const originalTitle = normMap.get(p.title) ?? p.title
      out.set(originalTitle, p.extract ?? '')
      out.set(p.title, p.extract ?? '')
    }
  }
  return out
}

export async function getLinks(
  title: string,
  maxLinks = 500,
  signal?: AbortSignal,
): Promise<string[]> {
  const all: string[] = []
  let plcontinue: string | undefined
  let safety = 0
  while (all.length < maxLinks && safety < 4) {
    const params: Record<string, string> = {
      action: 'query',
      titles: title,
      prop: 'links',
      pllimit: 'max',
      plnamespace: '0',
      redirects: '1',
    }
    if (plcontinue) params.plcontinue = plcontinue
    const res = await fetch(apiUrl(params), { signal })
    if (!res.ok) break
    const data = await res.json()
    const pages = data?.query?.pages ?? {}
    for (const p of Object.values(pages) as { links?: { title: string }[] }[]) {
      if (p.links) for (const l of p.links) all.push(l.title)
    }
    plcontinue = data?.continue?.plcontinue
    if (!plcontinue) break
    safety += 1
  }
  return all.slice(0, maxLinks)
}

export function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}
