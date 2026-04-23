import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before importing service
vi.mock('@/lib/db/client', () => ({
  prisma: {
    ga4DailyMetric: {
      aggregate: vi.fn(),
    },
    nurtureLead: {
      groupBy: vi.fn(),
    },
    seoKeyword: {
      findMany: vi.fn(),
    },
    approvalItem: {
      groupBy: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db/client'
import { getAttributionFunnel, getSeoAttribution, getModuleActivity } from '../service'

const mockPrisma = prisma as {
  ga4DailyMetric: { aggregate: ReturnType<typeof vi.fn> }
  nurtureLead: { groupBy: ReturnType<typeof vi.fn> }
  seoKeyword: { findMany: ReturnType<typeof vi.fn> }
  approvalItem: { groupBy: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAttributionFunnel', () => {
  it('calculates organic rate correctly', async () => {
    mockPrisma.ga4DailyMetric.aggregate.mockResolvedValue({
      _sum: { sessions: 1000, organicSessions: 400 },
    })
    mockPrisma.nurtureLead.groupBy.mockResolvedValue([])

    const funnel = await getAttributionFunnel('tenant-1')
    const organicStep = funnel.steps[1]

    expect(organicStep.value).toBe(400)
    expect(organicStep.rate).toBe(40) // 400/1000 * 100
  })

  it('returns null rate when sessions is 0', async () => {
    mockPrisma.ga4DailyMetric.aggregate.mockResolvedValue({
      _sum: { sessions: 0, organicSessions: 0 },
    })
    mockPrisma.nurtureLead.groupBy.mockResolvedValue([])

    const funnel = await getAttributionFunnel('tenant-1')
    expect(funnel.steps[1].rate).toBeNull()
  })

  it('calculates MQL/Lead rate correctly', async () => {
    mockPrisma.ga4DailyMetric.aggregate.mockResolvedValue({
      _sum: { sessions: 0, organicSessions: 0 },
    })
    mockPrisma.nurtureLead.groupBy.mockResolvedValue([
      { lifecycle: 'lead', _count: { id: 50 } },
      { lifecycle: 'marketingqualifiedlead', _count: { id: 20 } },
      { lifecycle: 'salesqualifiedlead', _count: { id: 5 } },
    ])

    const funnel = await getAttributionFunnel('tenant-1')
    const mqlStep = funnel.steps[3]
    const sqlStep = funnel.steps[4]

    expect(mqlStep.value).toBe(20)
    expect(mqlStep.rate).toBe(27) // 20/75 * 100 ≈ 26.67 → rounded 27
    expect(sqlStep.value).toBe(5)
    expect(sqlStep.rate).toBe(25) // 5/20 * 100
  })

  it('counts opportunity leads in SQL step', async () => {
    mockPrisma.ga4DailyMetric.aggregate.mockResolvedValue({
      _sum: { sessions: 0, organicSessions: 0 },
    })
    mockPrisma.nurtureLead.groupBy.mockResolvedValue([
      { lifecycle: 'marketingqualifiedlead', _count: { id: 10 } },
      { lifecycle: 'salesqualifiedlead', _count: { id: 3 } },
      { lifecycle: 'opportunity', _count: { id: 2 } },
    ])

    const funnel = await getAttributionFunnel('tenant-1')
    const sqlStep = funnel.steps[4]

    expect(sqlStep.value).toBe(5) // 3 + 2
  })

  it('returns 5 funnel steps', async () => {
    mockPrisma.ga4DailyMetric.aggregate.mockResolvedValue({
      _sum: { sessions: null, organicSessions: null },
    })
    mockPrisma.nurtureLead.groupBy.mockResolvedValue([])

    const funnel = await getAttributionFunnel('tenant-1')
    expect(funnel.steps).toHaveLength(5)
    expect(funnel.period).toBe('直近 30 日')
  })

  it('handles null aggregate values gracefully', async () => {
    mockPrisma.ga4DailyMetric.aggregate.mockResolvedValue({
      _sum: { sessions: null, organicSessions: null },
    })
    mockPrisma.nurtureLead.groupBy.mockResolvedValue([])

    const funnel = await getAttributionFunnel('tenant-1')
    expect(funnel.steps[0].value).toBe(0)
    expect(funnel.steps[1].value).toBe(0)
  })
})

describe('getSeoAttribution', () => {
  it('returns keywords sorted by clicks descending', async () => {
    mockPrisma.seoKeyword.findMany.mockResolvedValue([
      {
        text: 'low traffic keyword',
        snapshots: [{ snapshotDate: new Date(), clicks: 10, impressions: 100, position: 5.2 }],
      },
      {
        text: 'high traffic keyword',
        snapshots: [{ snapshotDate: new Date(), clicks: 500, impressions: 5000, position: 1.8 }],
      },
    ])

    const rows = await getSeoAttribution('tenant-1')
    expect(rows[0].keyword).toBe('high traffic keyword')
    expect(rows[1].keyword).toBe('low traffic keyword')
  })

  it('rounds position to integer', async () => {
    mockPrisma.seoKeyword.findMany.mockResolvedValue([
      {
        text: 'test keyword',
        snapshots: [{ snapshotDate: new Date(), clicks: 100, impressions: 1000, position: 3.7 }],
      },
    ])

    const rows = await getSeoAttribution('tenant-1')
    expect(rows[0].latestPosition).toBe(4) // Math.round(3.7)
  })

  it('returns null position when no snapshots', async () => {
    mockPrisma.seoKeyword.findMany.mockResolvedValue([
      { text: 'no data keyword', snapshots: [] },
    ])

    const rows = await getSeoAttribution('tenant-1')
    expect(rows[0].latestPosition).toBeNull()
  })

  it('sums clicks and impressions across all snapshots', async () => {
    mockPrisma.seoKeyword.findMany.mockResolvedValue([
      {
        text: 'keyword',
        snapshots: [
          { snapshotDate: new Date(), clicks: 100, impressions: 1000, position: 2 },
          { snapshotDate: new Date(), clicks: 150, impressions: 1200, position: 3 },
        ],
      },
    ])

    const rows = await getSeoAttribution('tenant-1')
    expect(rows[0].clicks30d).toBe(250)
    expect(rows[0].impressions30d).toBe(2200)
  })
})

describe('getModuleActivity', () => {
  it('aggregates pending and approved counts by module', async () => {
    mockPrisma.approvalItem.groupBy.mockResolvedValue([
      { module: 'aeo', status: 'PENDING', _count: { id: 5 } },
      { module: 'aeo', status: 'APPROVED', _count: { id: 10 } },
      { module: 'seo', status: 'PENDING', _count: { id: 3 } },
    ])

    const activity = await getModuleActivity('tenant-1')
    const aeo = activity.find((m) => m.module === 'aeo')
    const seo = activity.find((m) => m.module === 'seo')

    expect(aeo?.pending).toBe(5)
    expect(aeo?.approved).toBe(10)
    expect(aeo?.total).toBe(15)
    expect(seo?.pending).toBe(3)
    expect(seo?.approved).toBe(0)
    expect(seo?.total).toBe(3)
  })

  it('maps module keys to Japanese labels', async () => {
    mockPrisma.approvalItem.groupBy.mockResolvedValue([
      { module: 'aeo', status: 'APPROVED', _count: { id: 1 } },
      { module: 'seo', status: 'APPROVED', _count: { id: 1 } },
      { module: 'nurturing', status: 'APPROVED', _count: { id: 1 } },
    ])

    const activity = await getModuleActivity('tenant-1')
    const labels = activity.map((m) => m.label)

    expect(labels).toContain('AEO')
    expect(labels).toContain('SEO')
    expect(labels).toContain('ナーチャリング')
  })
})
