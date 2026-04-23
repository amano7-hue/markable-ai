import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/integrations/gsc', () => ({
  exchangeCodeForTokens: vi.fn(),
  getGscAuthUrl: vi.fn(),
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

import { exchangeCodeForTokens } from '@/integrations/gsc'
import { prisma } from '@/lib/db/client'
import { redirect } from 'next/navigation'
import { GET } from '../callback/route'

const mockExchange = exchangeCodeForTokens as ReturnType<typeof vi.fn>
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
