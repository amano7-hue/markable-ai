import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/integrations/gsc', () => ({
  exchangeCodeForTokens: vi.fn(),
  getGscAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=t1'),
}))

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    gscConnection: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
  }),
}))

import { exchangeCodeForTokens, getGscAuthUrl } from '@/integrations/gsc'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { redirect } from 'next/navigation'
import { GET } from '../callback/route'
import { GET as authGET } from '../route'

const mockExchange = exchangeCodeForTokens as ReturnType<typeof vi.fn>
const mockGetGscAuthUrl = getGscAuthUrl as ReturnType<typeof vi.fn>
const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockUpsert = prisma.gscConnection.upsert as ReturnType<typeof vi.fn>
const mockRedirect = redirect as ReturnType<typeof vi.fn>

const mockTokens = {
  email: 'user@example.com',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date('2026-12-31'),
}

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/auth/gsc/callback')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString())
}

function getRedirectTarget(error: unknown): string {
  if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
    return (error as Error & { digest: string }).digest.replace('NEXT_REDIRECT;', '')
  }
  throw error
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ siteEntry: [{ siteUrl: 'https://example.com/' }] }),
  })
})

describe('GET /api/auth/gsc/callback', () => {
  it('redirects to error when error param present', async () => {
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })

    const error = await GET(makeRequest({ error: 'access_denied', code: 'c', state: 't1' })).catch(e => e)
    expect(getRedirectTarget(error)).toContain('error=oauth_failed')
  })

  it('redirects to error when code is missing', async () => {
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })

    const error = await GET(makeRequest({ state: 't1' })).catch(e => e)
    expect(getRedirectTarget(error)).toContain('error=oauth_failed')
  })

  it('redirects to error when state is missing', async () => {
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })

    const error = await GET(makeRequest({ code: 'code' })).catch(e => e)
    expect(getRedirectTarget(error)).toContain('error=oauth_failed')
  })

  it('upserts connection and redirects to success', async () => {
    mockExchange.mockResolvedValue(mockTokens)
    mockUpsert.mockResolvedValue({})
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })

    const error = await GET(makeRequest({ code: 'auth-code', state: 't1' })).catch(e => e)
    expect(getRedirectTarget(error)).toContain('connected=true')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    )
  })

  it('stores siteUrl from Google API response', async () => {
    mockExchange.mockResolvedValue(mockTokens)
    mockUpsert.mockResolvedValue({})
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })

    await GET(makeRequest({ code: 'auth-code', state: 't1' })).catch(() => {})
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ siteUrl: 'https://example.com/', tenantId: 't1' }),
      }),
    )
  })

  it('uses empty siteUrl when no sites returned', async () => {
    mockExchange.mockResolvedValue(mockTokens)
    mockUpsert.mockResolvedValue({})
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
    })

    await GET(makeRequest({ code: 'auth-code', state: 't1' })).catch(() => {})
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ siteUrl: '' }),
      }),
    )
  })

  it('redirects to error when exchangeCodeForTokens throws', async () => {
    mockExchange.mockRejectedValue(new Error('token error'))
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })

    const error = await GET(makeRequest({ code: 'bad-code', state: 't1' })).catch(e => e)
    expect(getRedirectTarget(error)).toContain('error=token_exchange_failed')
  })
})

// ─── GET /api/auth/gsc (initiate OAuth) ──────────────────────────────────────

describe('GET /api/auth/gsc', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await authGET()
    expect(res.status).toBe(401)
  })

  it('redirects to GSC OAuth URL when authenticated', async () => {
    mockGetAuth.mockResolvedValue({ tenant: { id: 't1' } })
    mockGetGscAuthUrl.mockReturnValue('https://accounts.google.com/?state=t1')
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })

    const error = await authGET().catch(e => e)
    expect(getRedirectTarget(error)).toContain('accounts.google.com')
  })

  it('passes tenantId to getGscAuthUrl', async () => {
    mockGetAuth.mockResolvedValue({ tenant: { id: 'specific-tenant' } })
    mockGetGscAuthUrl.mockReturnValue('https://accounts.google.com/?state=specific-tenant')
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
    })

    await authGET().catch(() => {})
    expect(mockGetGscAuthUrl).toHaveBeenCalledWith('specific-tenant')
  })
})
