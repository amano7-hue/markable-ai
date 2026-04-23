import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ga4DailyMetric: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    ga4Connection: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/integrations/ga4', () => ({
  getGa4Client: vi.fn(),
}))

import { prisma } from '@/lib/db/client'
import { getMetricsSummary } from '../service'

const mockAggregate = prisma.ga4DailyMetric.aggregate as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMetricsSummary', () => {
  it('calculates organic share percentage', async () => {
    mockAggregate
      .mockResolvedValueOnce({
        _sum: { sessions: 1000, users: 800, pageviews: 3000, organicSessions: 600 },
      })
      .mockResolvedValueOnce({ _sum: { sessions: 200 } })
      .mockResolvedValueOnce({ _sum: { sessions: 200 } })

    const summary = await getMetricsSummary('tenant-1')
    expect(summary.organicShare).toBe(60) // 600/1000 * 100
  })

  it('returns 0 organic share when no sessions', async () => {
    mockAggregate
      .mockResolvedValueOnce({
        _sum: { sessions: 0, users: 0, pageviews: 0, organicSessions: 0 },
      })
      .mockResolvedValueOnce({ _sum: { sessions: 0 } })
      .mockResolvedValueOnce({ _sum: { sessions: 0 } })

    const summary = await getMetricsSummary('tenant-1')
    expect(summary.organicShare).toBe(0)
  })

  it('calculates positive sessions trend', async () => {
    mockAggregate
      .mockResolvedValueOnce({
        _sum: { sessions: 1000, users: 800, pageviews: 3000, organicSessions: 400 },
      })
      .mockResolvedValueOnce({ _sum: { sessions: 150 } }) // this week
      .mockResolvedValueOnce({ _sum: { sessions: 100 } }) // last week

    const summary = await getMetricsSummary('tenant-1')
    expect(summary.sessionsTrend).toBe(50) // (150-100)/100 * 100
  })

  it('calculates negative sessions trend', async () => {
    mockAggregate
      .mockResolvedValueOnce({
        _sum: { sessions: 1000, users: 800, pageviews: 3000, organicSessions: 400 },
      })
      .mockResolvedValueOnce({ _sum: { sessions: 80 } }) // this week
      .mockResolvedValueOnce({ _sum: { sessions: 100 } }) // last week

    const summary = await getMetricsSummary('tenant-1')
    expect(summary.sessionsTrend).toBe(-20) // (80-100)/100 * 100
  })

  it('returns 0 trend when last week had no sessions', async () => {
    mockAggregate
      .mockResolvedValueOnce({
        _sum: { sessions: 100, users: 80, pageviews: 300, organicSessions: 40 },
      })
      .mockResolvedValueOnce({ _sum: { sessions: 50 } })
      .mockResolvedValueOnce({ _sum: { sessions: 0 } }) // no last week data

    const summary = await getMetricsSummary('tenant-1')
    expect(summary.sessionsTrend).toBe(0)
  })

  it('handles null aggregate _sum values', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { sessions: null, users: null, pageviews: null, organicSessions: null } })
      .mockResolvedValueOnce({ _sum: { sessions: null } })
      .mockResolvedValueOnce({ _sum: { sessions: null } })

    const summary = await getMetricsSummary('tenant-1')
    expect(summary.totalSessions).toBe(0)
    expect(summary.totalUsers).toBe(0)
    expect(summary.totalPageviews).toBe(0)
    expect(summary.totalOrganicSessions).toBe(0)
    expect(summary.organicShare).toBe(0)
    expect(summary.sessionsTrend).toBe(0)
  })
})
