import { describe, it, expect } from 'vitest'
import { SerankingMockClient } from '../mock-client'

describe('SerankingMockClient', () => {
  const client = new SerankingMockClient()
  const date = '2025-01-01'

  it('returns one result per engine per prompt', async () => {
    const results = await client.getPromptResults('proj1', ['prompt1', 'prompt2'], date)
    // 2 prompts × 4 engines = 8
    expect(results).toHaveLength(8)
  })

  it('returns empty array for no prompts', async () => {
    const results = await client.getPromptResults('proj1', [], date)
    expect(results).toHaveLength(0)
  })

  it('each result has required fields', async () => {
    const results = await client.getPromptResults('proj1', ['prompt1'], date)
    for (const r of results) {
      expect(typeof r.promptId).toBe('string')
      expect(typeof r.engine).toBe('string')
      expect(r.snapshotDate).toBe(date)
      expect(Array.isArray(r.citations)).toBe(true)
    }
  })

  it('citations are ranked starting at 1', async () => {
    const results = await client.getPromptResults('proj1', ['prompt1'], date)
    for (const r of results) {
      expect(r.citations.length).toBeGreaterThan(0)
      expect(r.citations[0].rank).toBe(1)
      r.citations.forEach((c, idx) => expect(c.rank).toBe(idx + 1))
    }
  })

  it('results are deterministic for same inputs', async () => {
    const r1 = await client.getPromptResults('proj1', ['pid1'], date)
    const r2 = await client.getPromptResults('proj1', ['pid1'], date)
    expect(r1).toEqual(r2)
  })

  it('covers all 4 engines', async () => {
    const results = await client.getPromptResults('proj1', ['prompt1'], date)
    const engines = new Set(results.map((r) => r.engine))
    expect(engines.size).toBe(4)
    expect(engines.has('chatgpt')).toBe(true)
    expect(engines.has('perplexity')).toBe(true)
    expect(engines.has('gemini')).toBe(true)
    expect(engines.has('google_ai_overview')).toBe(true)
  })
})
