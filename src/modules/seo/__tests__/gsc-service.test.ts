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
import { getTopOpportunities } from '../gsc-service'

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
