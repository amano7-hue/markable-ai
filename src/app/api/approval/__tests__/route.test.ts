import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    approvalItem: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { GET, PATCH } from '../route'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockFindMany = prisma.approvalItem.findMany as ReturnType<typeof vi.fn>
const mockUpdateMany = prisma.approvalItem.updateMany as ReturnType<typeof vi.fn>

function makeCtx(tenantId = 't1', userId = 'u1') {
  return { clerkId: 'clerk1', user: { id: userId }, tenant: { id: tenantId } }
}

function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(`http://localhost${url}`, opts)
}

beforeEach(() => vi.clearAllMocks())

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/approval', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await GET(makeRequest('/api/approval'))
    expect(res.status).toBe(401)
  })

  it('returns items scoped to tenant', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    const items = [{ id: 'a1', tenantId: 't1', module: 'seo', status: 'PENDING' }]
    mockFindMany.mockResolvedValue(items)

    const res = await GET(makeRequest('/api/approval'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(items)
  })

  it('passes tenantId to findMany where clause', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('tenant-abc'))
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('/api/approval'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-abc' }) }),
    )
  })

  it('filters by module query param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('/api/approval?module=seo'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ module: 'seo' }) }),
    )
  })

  it('filters by status query param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('/api/approval?status=APPROVED'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'APPROVED' }) }),
    )
  })

  it('omits module/status when not in query', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('/api/approval'))
    const call = mockFindMany.mock.calls[0][0]
    expect('module' in call.where).toBe(false)
    expect('status' in call.where).toBe(false)
  })
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/approval', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'invalid' }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('sets status APPROVED for approve action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    )
  })

  it('sets status REJECTED for reject action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'reject' }),
      }),
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    )
  })

  it('scopes updateMany to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific'))
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't-specific' }),
      }),
    )
  })

  it('returns 404 when item not found in tenant', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const res = await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'missing', action: 'approve' }),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('returns ok with updated: true on success', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdateMany.mockResolvedValue({ count: 1 })

    const res = await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.updated).toBe(true)
  })
})
