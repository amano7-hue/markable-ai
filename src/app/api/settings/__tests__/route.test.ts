import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { GET, PATCH } from '../route'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockTenantFindUnique = prisma.tenant.findUnique as ReturnType<typeof vi.fn>
const mockTenantUpdate = prisma.tenant.update as ReturnType<typeof vi.fn>

function makeCtx(tenantId = 't1') {
  return { clerkId: 'clerk1', user: { id: 'u1' }, tenant: { id: tenantId } }
}

beforeEach(() => vi.clearAllMocks())

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/settings', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns tenant data', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    const tenant = { id: 't1', name: 'Acme', slug: 'acme', ownDomain: null, serankingProjectId: null }
    mockTenantFindUnique.mockResolvedValue(tenant)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('t1')
    expect(data.name).toBe('Acme')
  })

  it('queries with tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockTenantFindUnique.mockResolvedValue({})

    await GET()
    expect(mockTenantFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'specific-tenant' } }),
    )
  })
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/settings', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: '{"name":"Acme"}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: '{"name":123}' }))
    expect(res.status).toBe(400)
  })

  it('updates name successfully', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    const updated = { id: 't1', name: 'New Name', slug: 'acme', ownDomain: null, serankingProjectId: null }
    mockTenantUpdate.mockResolvedValue(updated)

    const res = await PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: '{"name":"New Name"}' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('New Name')
  })

  it('converts empty ownDomain to null', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockTenantUpdate.mockResolvedValue({ ownDomain: null })

    await PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: '{"ownDomain":""}' }))
    expect(mockTenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownDomain: null }) }),
    )
  })

  it('preserves non-empty ownDomain', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockTenantUpdate.mockResolvedValue({ ownDomain: 'example.com' })

    await PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: '{"ownDomain":"example.com"}' }))
    expect(mockTenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownDomain: 'example.com' }) }),
    )
  })

  it('converts empty serankingProjectId to null', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockTenantUpdate.mockResolvedValue({ serankingProjectId: null })

    await PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: '{"serankingProjectId":""}' }))
    expect(mockTenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ serankingProjectId: null }) }),
    )
  })

  it('omits keys not provided (partial update)', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockTenantUpdate.mockResolvedValue({ name: 'Acme' })

    await PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: '{"name":"Acme"}' }))
    const call = mockTenantUpdate.mock.calls[0][0]
    expect(call.data.name).toBe('Acme')
    expect('ownDomain' in call.data).toBe(false)
    expect('serankingProjectId' in call.data).toBe(false)
  })

  it('scopes update to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockTenantUpdate.mockResolvedValue({})

    await PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: '{"name":"Test"}' }))
    expect(mockTenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'specific-tenant' } }),
    )
  })
})
