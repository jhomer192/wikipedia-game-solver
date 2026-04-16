const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'also', 'am', 'an', 'and', 'any',
  'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'by', 'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so',
  'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with',
  'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
}

export type Vector = Map<string, number>

export function buildTfIdfVectors(docs: string[]): Vector[] {
  if (docs.length === 0) return []
  const tokenized = docs.map(tokenize)
  const df = new Map<string, number>()
  for (const tokens of tokenized) {
    const seen = new Set(tokens)
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1)
  }
  const N = docs.length
  return tokenized.map((tokens) => {
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    const vec = new Map<string, number>()
    for (const [t, freq] of tf) {
      const d = df.get(t) ?? 1
      const idf = Math.log((N + 1) / (d + 1)) + 1
      vec.set(t, freq * idf)
    }
    return vec
  })
}

export function cosineSim(a: Vector, b: Vector): number {
  if (a.size === 0 || b.size === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  const smaller = a.size < b.size ? a : b
  const larger = a.size < b.size ? b : a
  for (const [t, v] of smaller) {
    const u = larger.get(t)
    if (u !== undefined) dot += v * u
  }
  for (const v of a.values()) na += v * v
  for (const v of b.values()) nb += v * v
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function scoreCandidates(candidateTexts: string[], targetText: string): number[] {
  const corpus = [...candidateTexts, targetText]
  const vecs = buildTfIdfVectors(corpus)
  const target = vecs[vecs.length - 1]
  return vecs.slice(0, -1).map((v) => cosineSim(v, target))
}
