import { describe, it, expect } from 'vitest'
import { tokenize, buildTfIdfVectors, cosineSim, scoreCandidates } from '../tfidf'

describe('tokenize', () => {
  it('lowercases, strips punctuation, drops short tokens and stopwords', () => {
    const tokens = tokenize("The quick brown Fox's jumps over 42 lazy dogs.")
    expect(tokens).toEqual(['quick', 'brown', 'fox', 'jumps', 'lazy', 'dogs'])
  })

  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([])
  })

  it('drops pure-digit tokens', () => {
    expect(tokenize('born 1942 in Kansas')).toEqual(['born', 'kansas'])
  })

  it('keeps alphanumeric tokens with digits mixed in', () => {
    expect(tokenize('covid19 was the thing')).toContain('covid19')
  })
})

describe('buildTfIdfVectors + cosineSim', () => {
  it('identical documents have cosine similarity 1', () => {
    const [a, b] = buildTfIdfVectors(['aviation pilot flight', 'aviation pilot flight'])
    expect(cosineSim(a, b)).toBeCloseTo(1, 6)
  })

  it('completely disjoint documents have cosine similarity 0', () => {
    const [a, b] = buildTfIdfVectors(['aviation pilot flight', 'banana dessert sugar'])
    expect(cosineSim(a, b)).toBe(0)
  })

  it('shared terms produce positive similarity less than 1', () => {
    const [a, b] = buildTfIdfVectors([
      'aviation pilot flight aircraft',
      'aviation pilot navigator',
    ])
    const sim = cosineSim(a, b)
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })

  it('empty vectors yield zero similarity', () => {
    expect(cosineSim(new Map(), new Map())).toBe(0)
  })
})

describe('scoreCandidates', () => {
  it('ranks thematically closer candidates higher', () => {
    const target = 'Amelia Earhart was an American aviation pioneer. She was the first female aviator to fly solo across the Atlantic Ocean.'
    const candidates = [
      'Chocolate cake is a dessert made with cocoa and sugar.',
      'Pilots are trained professionals who fly aircraft across oceans and continents.',
      'Mathematics is the study of numbers and shapes.',
    ]
    const scores = scoreCandidates(candidates, target)
    expect(scores.length).toBe(3)
    // The pilot one should score strictly higher than the other two.
    expect(scores[1]).toBeGreaterThan(scores[0])
    expect(scores[1]).toBeGreaterThan(scores[2])
  })

  it('returns zero scores for empty candidate texts', () => {
    const scores = scoreCandidates(['', '', ''], 'Some target text here about things.')
    expect(scores).toEqual([0, 0, 0])
  })

  it('returns array length matching candidate count', () => {
    const scores = scoreCandidates(
      ['alpha beta', 'gamma delta', 'epsilon zeta', 'eta theta'],
      'alpha beta gamma',
    )
    expect(scores.length).toBe(4)
  })
})
