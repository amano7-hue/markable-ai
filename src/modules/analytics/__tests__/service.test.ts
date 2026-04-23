import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ga4DailyMetric: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
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
import * as Ga4Integration from '@/integrations/ga4'
import { getMetricsSummary, syncGa4Data, listDailyMetrics } from '../service'

const mockAggregate = prisma.ga4DailyMetric.aggregate as ReturnType<typeof vi.fn>
const mockFindMany = prisma.ga4DailyMetric.findMany as ReturnType<typeof vi.fn>
const mockUpsert = prisma.ga4DailyMetric.upsert as ReturnType<typeof vi.fn>
const mockGa4ConnectionFindUnique = prisma.ga4Connection.findUnique as ReturnType<typeof vi.fn>
const mockGetGa4Client = Ga4Integration.getGa4Client as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getMetricsSummary ────────────────────────────────────────────────────────

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

// ─── syncGa4Data ──────────────────────────────────────────────────────────────

describe('syncGa4Data', () => {
  function makeRow(date: string) {
    return { date, sessions: 100, users: 80, newUsers: 20, pageviews: 300, organicSessions: 60 }
  }

  beforeEach(() => {
    mockGa4ConnectionFindUnique.mockResolvedValue(null)
    mockGetGa4Client.mockResolvedValue({
      client: { getDailyMetrics: vi.fn().mockResolvedValue([]) },
      propertyId: 'mock',
    })
    mockUpsert.mockResolvedValue({})
  })

  it('returns 0 for empty rows', async () => {
    const count = await syncGa4Data('t1')
    expect(count).toBe(0)
  })

  it('returns row count', async () => {
    const mockClient = { getDailyMetrics: vi.fn().mockResolvedValue([makeRow('20260420'), makeRow('20260421')]) }
    mockGetGa4Client.mockResolvedValue({ client: mockClient, propertyId: 'mock' })

    const count = await syncGa4Data('t1')
    expect(count).toBe(2)
    expect(mockUpsert).toHaveBeenCalledTimes(2)
  })

  it('parses YYYYMMDD date format to UTC Date', async () => {
    const mockClient = { getDailyMetrics: vi.fn().mockResolvedValue([makeRow('20260420')]) }
    mockGetGa4Client.mockResolvedValue({ client: mockClient, propertyId: 'mock' })

    await syncGa4Data('t1')
    const upsertCall = mockUpsert.mock.calls[0][0]
    const date = upsertCall.create.date as Date
    expect(date.getUTCFullYear()).toBe(2026)
    expect(date.getUTCMonth()).toBe(3) // April (0-indexed)
    expect(date.getUTCDate()).toBe(20)
  })

  it('upserts with tenantId in where clause', async () => {
    const mockClient = { getDailyMetrics: vi.fn().mockResolvedValue([makeRow('20260420')]) }
    mockGetGa4Client.mockResolvedValue({ client: mockClient, propertyId: 'mock' })

    await syncGa4Data('specific-tenant')
    const upsertCall = mockUpsert.mock.calls[0][0]
    expect(upsertCall.where.tenantId_date.tenantId).toBe('specific-tenant')
  })
})

// ─── listDailyMetrics ─────────────────────────────────────────────────────────

describe('listDailyMetrics', () => {
  it('queries with tenantId', async () => {
    mockFindMany.mockResolvedValue([])
    await listDailyMetrics('t1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }) }),
    )
  })

  it('orders by date ascending', async () => {
    mockFindMany.mockResolvedValue([])
    await listDailyMetrics('t1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { date: 'asc' } }),
    )
  })
})
