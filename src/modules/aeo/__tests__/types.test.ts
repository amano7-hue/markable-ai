import { describe, it, expect } from 'vitest'
import { parseAeoSuggestionPayload } from '../types'

const VALID_PAYLOAD = {
  promptId: 'p1',
  promptText: 'おすすめの CRM ツールは？',
  gaps: [
    { engine: 'CHATGPT', competitorDomain: 'competitor.com', competitorRank: 1 },
  ],
  suggestion: 'コンテンツを充実させてください。',
  generatedAt: '2025-01-01T00:00:00.000Z',
}

describe('parseAeoSuggestionPayload', () => {
  it('parses valid payload', () => {
    const result = parseAeoSuggestionPayload(VALID_PAYLOAD)
    expect(result.promptId).toBe('p1')
    expect(result.suggestion).toBe('コンテンツを充実させてください。')
    expect(result.gaps).toHaveLength(1)
  })

  it('accepts empty gaps array', () => {
    const result = parseAeoSuggestionPayload({ ...VALID_PAYLOAD, gaps: [] })
    expect(result.gaps).toHaveLength(0)
  })

  it('throws on missing promptText', () => {
    const { promptText: _, ...rest } = VALID_PAYLOAD
    expect(() => parseAeoSuggestionPayload(rest)).toThrow()
  })

  it('throws on missing suggestion', () => {
    const { suggestion: _, ...rest } = VALID_PAYLOAD
    expect(() => parseAeoSuggestionPayload(rest)).toThrow()
  })

  it('throws on null input', () => {
    expect(() => parseAeoSuggestionPayload(null)).toThrow()
  })

  it('throws on non-numeric competitorRank', () => {
    const bad = {
      ...VALID_PAYLOAD,
      gaps: [{ engine: 'CHATGPT', competitorDomain: 'c.com', competitorRank: 'first' }],
    }
    expect(() => parseAeoSuggestionPayload(bad)).toThrow()
  })
})
