import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    aeoPrompt: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { POST } from '../route'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockFindFirst = prisma.aeoPrompt.findFirst as ReturnType<typeof vi.fn>
const mockCreate = prisma.aeoPrompt.create as ReturnType<typeof vi.fn>

function makeCtx(tenantId = 't1') {
  return { clerkId: 'c1', user: { id: 'u1' }, tenant: { id: tenantId } }
}

function makeRequest(body: object) {
  return new Request('http://localhost/api/aeo/prompts/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // createPrompt checks findFirst first
  mockFindFirst.mockResolvedValue(null)
  mockCreate.mockResolvedValue({ id: 'p1', tenantId: 't1', text: '', isActive: true })
})

describe('POST /api/aeo/prompts/batch', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await POST(makeRequest({ templateIds: ['btob-saas-crm'] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty templateIds', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await POST(makeRequest({ templateIds: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await POST(makeRequest({ not_valid: true }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no templates match the given ids', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await POST(makeRequest({ templateIds: ['nonexistent-template-id'] }))
    expect(res.status).toBe(400)
  })

  it('creates prompts for valid template ids', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await POST(makeRequest({ templateIds: ['btob-saas-crm', 'btob-saas-marketing'] }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.created).toBe(2)
    expect(data.skipped).toBe(0)
  })

  it('skips failed prompts (e.g., duplicates) and reports count', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    // First create succeeds, second fails
    mockCreate
      .mockResolvedValueOnce({ id: 'p1', tenantId: 't1', text: '', isActive: true })
      .mockRejectedValueOnce(new Error('Unique constraint'))

    const res = await POST(makeRequest({ templateIds: ['btob-saas-crm', 'btob-saas-marketing'] }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.created).toBe(1)
    expect(data.skipped).toBe(1)
  })

  it('respects max 20 templateIds limit', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const tooMany = Array.from({ length: 21 }, (_, i) => `id-${i}`)
    const res = await POST(makeRequest({ templateIds: tooMany }))
    expect(res.status).toBe(400)
  })
})
