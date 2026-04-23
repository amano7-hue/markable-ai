import { describe, it, expect } from 'vitest'
import { Ga4MockClient } from '../mock-client'

describe('Ga4MockClient', () => {
  const client = new Ga4MockClient()

  it('returns the requested number of rows', async () => {
    const rows = await client.getDailyMetrics('12345', 30)
    expect(rows).toHaveLength(30)
  })

  it('each row has required numeric fields', async () => {
    const rows = await client.getDailyMetrics('12345', 7)
    for (const row of rows) {
      expect(typeof row.date).toBe('string')
      expect(row.date).toMatch(/^\d{8}$/)
      expect(row.sessions).toBeGreaterThan(0)
      expect(row.users).toBeGreaterThan(0)
      expect(row.newUsers).toBeGreaterThan(0)
      expect(row.pageviews).toBeGreaterThan(0)
      expect(row.organicSessions).toBeGreaterThan(0)
    }
  })

  it('organicSessions <= sessions', async () => {
    const rows = await client.getDailyMetrics('12345', 7)
    expect(rows.every((r) => r.organicSessions <= r.sessions)).toBe(true)
  })

  it('users <= sessions', async () => {
    const rows = await client.getDailyMetrics('12345', 7)
    expect(rows.every((r) => r.users <= r.sessions)).toBe(true)
  })

  it('propertyId is ignored (mock)', async () => {
    const r1 = await client.getDailyMetrics('prop1', 1)
    const r2 = await client.getDailyMetrics('prop2', 1)
    // Both should return the same structure (length)
    expect(r1).toHaveLength(r2.length)
  })
})
