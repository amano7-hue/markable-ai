import { describe, it, expect } from 'vitest'
import { getTemplates } from '../template-service'

describe('getTemplates', () => {
  it('returns all templates when no filter given', () => {
    const result = getTemplates()
    expect(result.length).toBeGreaterThan(0)
  })

  it('filters by industry (exact match)', () => {
    const result = getTemplates('BtoB SaaS')
    expect(result.every((t) => t.industry.includes('BtoB SaaS'))).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('filters case-insensitively', () => {
    const lower = getTemplates('btob saas')
    const upper = getTemplates('BtoB SaaS')
    expect(lower).toEqual(upper)
  })

  it('returns empty array for unknown industry', () => {
    expect(getTemplates('unknown-industry-xyz')).toEqual([])
  })

  it('partial match works', () => {
    const result = getTemplates('製造')
    expect(result.every((t) => t.industry.includes('製造'))).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('each template has id, industry, text', () => {
    for (const t of getTemplates()) {
      expect(typeof t.id).toBe('string')
      expect(typeof t.industry).toBe('string')
      expect(typeof t.text).toBe('string')
      expect(t.id.length).toBeGreaterThan(0)
      expect(t.text.length).toBeGreaterThan(0)
    }
  })
})
