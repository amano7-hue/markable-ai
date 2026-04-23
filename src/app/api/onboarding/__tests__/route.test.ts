import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/tenant', () => ({
  createTenantWithOwner: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { createTenantWithOwner } from '@/lib/tenant'
import { POST } from '../route'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockCreateTenantWithOwner = createTenantWithOwner as ReturnType<typeof vi.fn>

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/onboarding', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await POST(makeRequest({ name: 'Acme', email: 'acme@example.com' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is empty', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    const res = await POST(makeRequest({ name: '', email: 'acme@example.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    const res = await POST(makeRequest({ email: 'acme@example.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is only whitespace', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    const res = await POST(makeRequest({ name: '   ', email: 'acme@example.com' }))
    expect(res.status).toBe(400)
  })

  it('creates tenant and returns ok: true', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    mockCreateTenantWithOwner.mockResolvedValue({ tenant: { id: 't1' }, user: { id: 'u1' } })

    const res = await POST(makeRequest({ name: 'Acme Corp', email: 'acme@example.com' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('passes trimmed name to createTenantWithOwner', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    mockCreateTenantWithOwner.mockResolvedValue({ tenant: {}, user: {} })

    await POST(makeRequest({ name: '  Acme Corp  ', email: 'acme@example.com' }))
    expect(mockCreateTenantWithOwner).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Corp' }),
    )
  })

  it('passes clerkId to createTenantWithOwner', async () => {
    mockAuth.mockResolvedValue({ userId: 'specific-clerk-id' })
    mockCreateTenantWithOwner.mockResolvedValue({ tenant: {}, user: {} })

    await POST(makeRequest({ name: 'Acme', email: 'acme@example.com' }))
    expect(mockCreateTenantWithOwner).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: 'specific-clerk-id' }),
    )
  })

  it('returns 500 when createTenantWithOwner throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    mockCreateTenantWithOwner.mockRejectedValue(new Error('DB error'))

    const res = await POST(makeRequest({ name: 'Acme', email: 'acme@example.com' }))
    expect(res.status).toBe(500)
  })
})
