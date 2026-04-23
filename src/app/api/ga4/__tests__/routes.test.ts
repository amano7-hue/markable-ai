import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/modules/analytics', () => ({
  listDailyMetrics: vi.fn(),
  getMetricsSummary: vi.fn(),
  syncGa4Data: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ga4Connection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import * as AnalyticsModule from '@/modules/analytics'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockGa4ConnectionFindUnique = prisma.ga4Connection.findUnique as ReturnType<typeof vi.fn>
const mockGa4ConnectionUpdate = prisma.ga4Connection.update as ReturnType<typeof vi.fn>
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

// ─── GET/PATCH /api/ga4/connect ───────────────────────────────────────────────

import { GET as ga4ConnectGET, PATCH as ga4ConnectPATCH } from '../connect/route'

describe('GET /api/ga4/connect', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await ga4ConnectGET()
    expect(res.status).toBe(401)
  })

  it('returns connected: false when no connection', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGa4ConnectionFindUnique.mockResolvedValue(null)

    const res = await ga4ConnectGET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.connected).toBe(false)
    expect(data.connection).toBeNull()
  })

  it('returns connected: true with connection details', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const conn = { email: 'test@example.com', propertyId: '123456', updatedAt: new Date() }
    mockGa4ConnectionFindUnique.mockResolvedValue(conn)

    const res = await ga4ConnectGET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.connected).toBe(true)
  })
})

describe('PATCH /api/ga4/connect', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await ga4ConnectPATCH(
      new Request('http://localhost/api/ga4/connect', { method: 'PATCH', body: '{"propertyId":"123"}' }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing propertyId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await ga4ConnectPATCH(
      new Request('http://localhost/api/ga4/connect', { method: 'PATCH', body: '{}' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when no connection exists', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGa4ConnectionFindUnique.mockResolvedValue(null)

    const res = await ga4ConnectPATCH(
      new Request('http://localhost/api/ga4/connect', { method: 'PATCH', body: '{"propertyId":"123456"}' }),
    )
    expect(res.status).toBe(400)
  })

  it('updates propertyId when connection exists', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockGa4ConnectionFindUnique.mockResolvedValue({ id: 'c1' })
    mockGa4ConnectionUpdate.mockResolvedValue({})

    const res = await ga4ConnectPATCH(
      new Request('http://localhost/api/ga4/connect', { method: 'PATCH', body: '{"propertyId":"123456"}' }),
    )
    expect(res.status).toBe(200)
    expect(mockGa4ConnectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { propertyId: '123456' } }),
    )
  })
})
