import { describe, it, expect } from 'vitest'
import { GscMockClient } from '../mock-client'

describe('GscMockClient', () => {
  const client = new GscMockClient()

  it('returns rows for the requested date range', async () => {
    const rows = await client.searchAnalytics('https://example.com', '2025-01-01', '2025-01-03')
    // 3 days × 10 keywords = 30 rows
    expect(rows).toHaveLength(30)
  })

  it('single day returns 10 rows', async () => {
    const rows = await client.searchAnalytics('https://example.com', '2025-03-01', '2025-03-01')
    expect(rows).toHaveLength(10)
  })

  it('each row has required fields', async () => {
    const rows = await client.searchAnalytics('https://example.com', '2025-01-01', '2025-01-01')
    for (const row of rows) {
      expect(typeof row.keyword).toBe('string')
      expect(typeof row.date).toBe('string')
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof row.clicks).toBe('number')
      expect(typeof row.impressions).toBe('number')
      expect(typeof row.ctr).toBe('number')
      expect(typeof row.position).toBe('number')
    }
  })

  it('positions are positive numbers', async () => {
    const rows = await client.searchAnalytics('https://example.com', '2025-01-01', '2025-01-07')
    expect(rows.every((r) => r.position >= 1)).toBe(true)
  })

  it('CTR is between 0 and 1', async () => {
    const rows = await client.searchAnalytics('https://example.com', '2025-01-01', '2025-01-07')
    expect(rows.every((r) => r.ctr >= 0 && r.ctr <= 1)).toBe(true)
  })

  it('siteUrl parameter is ignored (mock)', async () => {
    const rows1 = await client.searchAnalytics('https://site1.com', '2025-01-01', '2025-01-01')
    const rows2 = await client.searchAnalytics('https://site2.com', '2025-01-01', '2025-01-01')
    expect(rows1).toEqual(rows2)
  })
})
