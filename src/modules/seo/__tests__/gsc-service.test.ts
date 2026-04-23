import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    seoKeyword: { upsert: vi.fn() },
    seoKeywordSnapshot: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db/client'
import { getTopOpportunities, getKeywordHistory, syncGscData } from '../gsc-service'
import type { GscClient, GscSearchRow } from '@/integrations/gsc'

const mockSnapshotFindMany = prisma.seoKeywordSnapshot.findMany as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getTopOpportunities', () => {
  it('returns empty array when no snapshots in range', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    const opps = await getTopOpportunities('tenant-1')
    expect(opps).toEqual([])
  })

  it('deduplicates keywords, returning only first (highest impression) snapshot per keyword', async () => {
    const date = new Date('2026-04-20')
    mockSnapshotFindMany.mockResolvedValue([
      {
        keywordId: 'kw1',
        position: 15,
        impressions: 1000,
        clicks: 30,
        ctr: 0.03,
        snapshotDate: date,
        keyword: { text: 'marketing automation', isActive: true },
      },
      {
        keywordId: 'kw1', // duplicate
        position: 16,
        impressions: 900,
        clicks: 25,
        ctr: 0.028,
        snapshotDate: new Date('2026-04-19'),
        keyword: { text: 'marketing automation', isActive: true },
      },
      {
        keywordId: 'kw2',
        position: 22,
        impressions: 500,
        clicks: 10,
        ctr: 0.02,
        snapshotDate: date,
        keyword: { text: 'crm software', isActive: true },
      },
    ])

    const opps = await getTopOpportunities('tenant-1')
    expect(opps).toHaveLength(2)
    // kw1 should only appear once (first occurrence = highest impressions)
    const kw1Entries = opps.filter((o) => o.keywordId === 'kw1')
    expect(kw1Entries).toHaveLength(1)
    expect(kw1Entries[0].impressions).toBe(1000)
  })

  it('skips inactive keywords', async () => {
    mockSnapshotFindMany.mockResolvedValue([
      {
        keywordId: 'kw1',
        position: 15,
        impressions: 1000,
        clicks: 30,
        ctr: 0.03,
        snapshotDate: new Date(),
        keyword: { text: 'inactive keyword', isActive: false },
      },
      {
        keywordId: 'kw2',
        position: 20,
        impressions: 500,
        clicks: 10,
        ctr: 0.02,
        snapshotDate: new Date(),
        keyword: { text: 'active keyword', isActive: true },
      },
    ])

    const opps = await getTopOpportunities('tenant-1')
    expect(opps).toHaveLength(1)
    expect(opps[0].keyword).toBe('active keyword')
  })

  it('maps snapshot fields correctly to TopOpportunity', async () => {
    const snapshotDate = new Date('2026-04-20')
    mockSnapshotFindMany.mockResolvedValue([
      {
        keywordId: 'kw1',
        position: 14.5,
        impressions: 800,
        clicks: 40,
        ctr: 0.05,
        snapshotDate,
        keyword: { text: 'b2b saas', isActive: true },
      },
    ])

    const opps = await getTopOpportunities('tenant-1')
    expect(opps[0]).toMatchObject({
      keywordId: 'kw1',
      keyword: 'b2b saas',
      position: 14.5,
      impressions: 800,
      clicks: 40,
      ctr: 0.05,
      snapshotDate,
    })
  })

  it('queries with position between 11 and 30', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    await getTopOpportunities('tenant-1')

    const callArgs = mockSnapshotFindMany.mock.calls[0][0]
    expect(callArgs.where.tenantId).toBe('tenant-1')
    expect(callArgs.where.position).toMatchObject({ gte: 11, lte: 30 })
  })
})

// ─── getKeywordHistory ────────────────────────────────────────────────────────

describe('getKeywordHistory', () => {
  it('returns snapshots for keyword', async () => {
    const snaps = [
      { id: 's1', keywordId: 'kw1', tenantId: 't1', snapshotDate: new Date('2026-04-01'), clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
    ]
    mockSnapshotFindMany.mockResolvedValue(snaps)
    const result = await getKeywordHistory('t1', 'kw1')
    expect(result).toEqual(snaps)
  })

  it('returns empty array when no history', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    const result = await getKeywordHistory('t1', 'kw-missing')
    expect(result).toEqual([])
  })

  it('queries with tenantId and keywordId', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    await getKeywordHistory('tenant-x', 'kw-y')
    const args = mockSnapshotFindMany.mock.calls[0][0]
    expect(args.where.tenantId).toBe('tenant-x')
    expect(args.where.keywordId).toBe('kw-y')
  })

  it('filters snapshots by date (default 30 days)', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    await getKeywordHistory('t1', 'kw1')
    const args = mockSnapshotFindMany.mock.calls[0][0]
    expect(args.where.snapshotDate).toBeDefined()
    expect(args.where.snapshotDate.gte).toBeInstanceOf(Date)
  })

  it('orders results ascending by snapshotDate', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    await getKeywordHistory('t1', 'kw1')
    const args = mockSnapshotFindMany.mock.calls[0][0]
    expect(args.orderBy).toEqual({ snapshotDate: 'asc' })
  })
})

describe('syncGscData', () => {
  const mockKeywordUpsert = prisma.seoKeyword.upsert as ReturnType<typeof vi.fn>
  const mockSnapshotUpsert = prisma.seoKeywordSnapshot.upsert as ReturnType<typeof vi.fn>

  function makeClient(rows: GscSearchRow[]): GscClient {
    return { searchAnalytics: vi.fn().mockResolvedValue(rows) }
  }

  beforeEach(() => {
    mockKeywordUpsert.mockResolvedValue({ id: 'kw1' })
    mockSnapshotUpsert.mockResolvedValue({})
  })

  it('returns 0 for empty rows', async () => {
    const count = await syncGscData('t1', 'https://example.com', makeClient([]))
    expect(count).toBe(0)
  })

  it('returns snapshot count', async () => {
    const rows: GscSearchRow[] = [
      { keyword: 'kw a', date: '2025-01-01', clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
      { keyword: 'kw b', date: '2025-01-01', clicks: 5, impressions: 50, ctr: 0.1, position: 8 },
    ]
    const count = await syncGscData('t1', 'https://example.com', makeClient(rows))
    expect(count).toBe(2)
  })

  it('reuses keywordId for same keyword across rows', async () => {
    mockKeywordUpsert.mockResolvedValueOnce({ id: 'kw1' })
    const rows: GscSearchRow[] = [
      { keyword: 'same', date: '2025-01-01', clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
      { keyword: 'same', date: '2025-01-02', clicks: 8, impressions: 90, ctr: 0.09, position: 6 },
    ]
    await syncGscData('t1', 'https://example.com', makeClient(rows))
    // keyword upsert should only be called once (cached in map)
    expect(mockKeywordUpsert).toHaveBeenCalledTimes(1)
    expect(mockSnapshotUpsert).toHaveBeenCalledTimes(2)
  })
})
