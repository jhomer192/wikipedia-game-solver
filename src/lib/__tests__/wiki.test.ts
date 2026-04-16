import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { opensearch, getIntro, getIntrosBatch, getLinks, articleUrl } from '../wiki'

function mockJson(data: unknown, ok = true) {
  return {
    ok,
    json: async () => data,
  } as Response
}

describe('articleUrl', () => {
  it('replaces spaces with underscores and URL-encodes', () => {
    expect(articleUrl('Albert Einstein')).toBe('https://en.wikipedia.org/wiki/Albert_Einstein')
    expect(articleUrl('Amélie (film)')).toBe('https://en.wikipedia.org/wiki/Am%C3%A9lie_(film)')
  })
})

describe('opensearch', () => {
  const fetchSpy = vi.fn()
  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty array for empty query', async () => {
    const out = await opensearch('   ')
    expect(out).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('hits the opensearch endpoint and maps results', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson([
        'dog',
        ['Dog', 'Dogon people'],
        ['a domestic animal', 'an ethnic group'],
        ['https://en.wikipedia.org/wiki/Dog', 'https://en.wikipedia.org/wiki/Dogon_people'],
      ]),
    )
    const out = await opensearch('dog')
    expect(fetchSpy).toHaveBeenCalledOnce()
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('action=opensearch')
    expect(url).toContain('search=dog')
    expect(out).toHaveLength(2)
    expect(out[0].title).toBe('Dog')
    expect(out[0].description).toBe('a domestic animal')
  })

  it('returns [] on non-ok response', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response)
    expect(await opensearch('x')).toEqual([])
  })
})

describe('getIntro', () => {
  const fetchSpy = vi.fn()
  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('extracts the intro from the first page entry', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson({
        query: { pages: { '123': { title: 'Dog', extract: 'Dogs are domestic animals.' } } },
      }),
    )
    const intro = await getIntro('Dog')
    expect(intro).toBe('Dogs are domestic animals.')
  })

  it('returns empty string on non-ok response', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response)
    expect(await getIntro('Dog')).toBe('')
  })

  it('passes redirects=1 and exintro=true', async () => {
    fetchSpy.mockResolvedValueOnce(mockJson({ query: { pages: {} } }))
    await getIntro('Dog')
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('exintro=true')
    expect(url).toContain('redirects=1')
  })
})

describe('getIntrosBatch', () => {
  const fetchSpy = vi.fn()
  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('returns empty map for empty titles', async () => {
    expect((await getIntrosBatch([])).size).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('batches >20 titles into multiple requests', async () => {
    const titles = Array.from({ length: 45 }, (_, i) => `Article ${i}`)
    fetchSpy.mockResolvedValue(mockJson({ query: { pages: {} } }))
    await getIntrosBatch(titles)
    expect(fetchSpy).toHaveBeenCalledTimes(3) // ceil(45/20) = 3
  })

  it('resolves original title when MediaWiki normalizes it', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson({
        query: {
          normalized: [{ from: 'dog', to: 'Dog' }],
          pages: { '1': { title: 'Dog', extract: 'about dogs' } },
        },
      }),
    )
    const out = await getIntrosBatch(['dog'])
    expect(out.get('dog')).toBe('about dogs')
    expect(out.get('Dog')).toBe('about dogs')
  })
})

describe('getLinks', () => {
  const fetchSpy = vi.fn()
  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('follows pagination via plcontinue up to safety cap', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        mockJson({
          query: { pages: { '1': { links: [{ title: 'A' }, { title: 'B' }] } } },
          continue: { plcontinue: 'token1' },
        }),
      )
      .mockResolvedValueOnce(
        mockJson({
          query: { pages: { '1': { links: [{ title: 'C' }] } } },
        }),
      )
    const result = await getLinks('Whatever', 500)
    expect(result.titles).toEqual(['A', 'B', 'C'])
    expect(result.calls).toBe(2)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    // second call should include plcontinue
    const url2 = fetchSpy.mock.calls[1][0] as string
    expect(url2).toContain('plcontinue=token1')
  })

  it('trims to maxLinks', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJson({
        query: {
          pages: {
            '1': {
              links: Array.from({ length: 100 }, (_, i) => ({ title: `L${i}` })),
            },
          },
        },
      }),
    )
    const result = await getLinks('X', 10)
    expect(result.titles).toHaveLength(10)
    expect(result.calls).toBe(1)
  })
})
