import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/modules/analytics', () => ({
  listDailyMetrics: vi.fn(),
  getMetricsSummary: vi.fn(),
  syncGa4Data: vi.fn(),
}))

import { getAuth } from '@/lib/auth/get-auth'
import * as AnalyticsModule from '@/modules/analytics'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockListDailyMetrics = AnalyticsModule.listDailyMetrics as ReturnType<typeof vi.fn>
const mockGetMetricsSummary = AnalyticsModule.getMetricsSummary as ReturnType<typeof vi.fn>
const mockSyncGa4Data = AnalyticsModule.syncGa4Data as ReturnType<typeof vi.fn>

function makeCtx(tenantId = 't1') {
  return { clerkId: 'clerk1', user: { id: 'u1' }, tenant: { id: tenantId } }
}

function makeRequest(url: string) {
  return new Request(`http://localhost${url}`)
}

beforeEach(() => vi.clearAllMocks())

// ─── GET /api/ga4/metrics ─────────────────────────────────────────────────────

import { GET as metricsGET } from '../metrics/route'

describe('GET /api/ga4/metrics', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await metricsGET(makeRequest('/api/ga4/metrics'))
    expect(res.status).toBe(401)
  })

  it('returns metrics and summary', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const metrics = [{ date: new Date(), sessions: 100 }]
    const summary = { totalSessions: 100, organicShare: 60 }
    mockListDailyMetrics.mockResolvedValue(metrics)
    mockGetMetricsSummary.mockResolvedValue(summary)

    const res = await metricsGET(makeRequest('/api/ga4/metrics'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.summary.totalSessions).toBe(100)
    expect(data.metrics).toHaveLength(1)
  })

  it('passes days param to listDailyMetrics', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockListDailyMetrics.mockResolvedValue([])
    mockGetMetricsSummary.mockResolvedValue({})

    await metricsGET(makeRequest('/api/ga4/metrics?days=7'))
    expect(mockListDailyMetrics).toHaveBeenCalledWith('t1', 7)
  })

  it('defaults to 30 days when no param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockListDailyMetrics.mockResolvedValue([])
    mockGetMetricsSummary.mockResolvedValue({})

    await metricsGET(makeRequest('/api/ga4/metrics'))
    expect(mockListDailyMetrics).toHaveBeenCalledWith('t1', 30)
  })

  it('passes tenantId to getMetricsSummary', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockListDailyMetrics.mockResolvedValue([])
    mockGetMetricsSummary.mockResolvedValue({})

    await metricsGET(makeRequest('/api/ga4/metrics'))
    expect(mockGetMetricsSummary).toHaveBeenCalledWith('specific-tenant')
  })
})

// ─── POST /api/ga4/sync ───────────────────────────────────────────────────────

import { POST as ga4SyncPOST } from '../sync/route'

describe('POST /api/ga4/sync', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await ga4SyncPOST()
    expect(res.status).toBe(401)
  })

  it('returns synced count with 202', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockSyncGa4Data.mockResolvedValue(15)

    const res = await ga4SyncPOST()
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.synced).toBe(15)
  })

  it('passes tenantId to syncGa4Data', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockSyncGa4Data.mockResolvedValue(0)

    await ga4SyncPOST()
    expect(mockSyncGa4Data).toHaveBeenCalledWith('specific-tenant')
  })
})
