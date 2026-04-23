import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/integrations/ga4', () => ({
  exchangeCodeForTokens: vi.fn(),
  getGa4AuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=t1'),
}))

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ga4Connection: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
  }),
}))

import { exchangeCodeForTokens, getGa4AuthUrl } from '@/integrations/ga4'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { GET } from '../callback/route'
import { GET as authGET } from '../route'

const mockExchange = exchangeCodeForTokens as ReturnType<typeof vi.fn>
const mockGetGa4AuthUrl = getGa4AuthUrl as ReturnType<typeof vi.fn>
const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockUpsert = prisma.ga4Connection.upsert as ReturnType<typeof vi.fn>

const mockTokens = {
  email: 'user@example.com',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date('2026-12-31'),
}

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/auth/ga4/callback')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString())
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

describe('GET /api/auth/ga4/callback', () => {
  it('redirects to error page when error param present', async () => {
    const res = await GET(makeRequest({ error: 'access_denied', code: 'code', state: 't1' }))
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.headers.get('location')).toContain('error=1')
  })

  it('redirects to error page when code is missing', async () => {
    const res = await GET(makeRequest({ state: 't1' }))
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.headers.get('location')).toContain('error=1')
  })

  it('redirects to error page when state is missing', async () => {
    const res = await GET(makeRequest({ code: 'code' }))
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.headers.get('location')).toContain('error=1')
  })

  it('upserts connection on success', async () => {
    mockExchange.mockResolvedValue(mockTokens)
    mockUpsert.mockResolvedValue({})

    const res = await GET(makeRequest({ code: 'auth-code', state: 't1' }))
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.headers.get('location')).toContain('connected=1')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    )
  })

  it('upserts with email from tokens', async () => {
    mockExchange.mockResolvedValue(mockTokens)
    mockUpsert.mockResolvedValue({})

    await GET(makeRequest({ code: 'auth-code', state: 't1' }))
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: 'user@example.com', tenantId: 't1' }),
      }),
    )
  })

  it('redirects to error page when exchangeCodeForTokens throws', async () => {
    mockExchange.mockRejectedValue(new Error('token error'))

    const res = await GET(makeRequest({ code: 'bad-code', state: 't1' }))
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.headers.get('location')).toContain('error=1')
  })
})

// ─── GET /api/auth/ga4 (initiate OAuth) ──────────────────────────────────────

describe('GET /api/auth/ga4', () => {
  it('redirects to onboarding when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const error = await authGET().catch(e => e)
    // next/navigation redirect throws
    expect(error.message).toBe('NEXT_REDIRECT')
    expect(error.digest).toContain('/onboarding')
  })

  it('redirects to GA4 OAuth URL when authenticated', async () => {
    mockGetAuth.mockResolvedValue({ tenant: { id: 't1' } })
    mockGetGa4AuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=t1')

    const res = await authGET()
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.headers.get('location')).toContain('accounts.google.com')
  })

  it('passes tenantId to getGa4AuthUrl', async () => {
    mockGetAuth.mockResolvedValue({ tenant: { id: 'specific-tenant' } })
    mockGetGa4AuthUrl.mockReturnValue('https://accounts.google.com/?state=specific-tenant')

    await authGET()
    expect(mockGetGa4AuthUrl).toHaveBeenCalledWith('specific-tenant')
  })
})
