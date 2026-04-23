import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGa4AuthUrl, exchangeCodeForTokens, refreshAccessToken } from '../oauth'

function makeIdToken(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ email })).toString('base64url')
  return `${header}.${payload}.signature`
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

describe('getGa4AuthUrl', () => {
  it('returns a Google OAuth URL', () => {
    const url = getGa4AuthUrl('tenant-state')
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth')
  })

  it('includes the state parameter', () => {
    const url = getGa4AuthUrl('my-tenant-id')
    expect(url).toContain('state=my-tenant-id')
  })

  it('includes GA4 analytics scope', () => {
    const url = getGa4AuthUrl('t1')
    expect(url).toContain('analytics.readonly')
  })

  it('includes offline access_type for refresh tokens', () => {
    const url = getGa4AuthUrl('t1')
    expect(url).toContain('access_type=offline')
  })
})

describe('exchangeCodeForTokens', () => {
  it('returns tokens on success', async () => {
    const idToken = makeIdToken('user@example.com')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'access-tok',
        refresh_token: 'refresh-tok',
        expires_in: 3600,
        id_token: idToken,
      }),
    })

    const result = await exchangeCodeForTokens('auth-code')
    expect(result.accessToken).toBe('access-tok')
    expect(result.refreshToken).toBe('refresh-tok')
    expect(result.email).toBe('user@example.com')
    expect(result.expiresAt).toBeInstanceOf(Date)
  })

  it('parses email from id_token', async () => {
    const idToken = makeIdToken('specific@example.com')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'tok',
        refresh_token: 'rtok',
        expires_in: 3600,
        id_token: idToken,
      }),
    })

    const result = await exchangeCodeForTokens('code')
    expect(result.email).toBe('specific@example.com')
  })

  it('returns empty email when no id_token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'tok',
        refresh_token: 'rtok',
        expires_in: 3600,
      }),
    })

    const result = await exchangeCodeForTokens('code')
    expect(result.email).toBe('')
  })

  it('throws when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('invalid_grant'),
    })

    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow('Token exchange failed')
  })

  it('sets expiresAt to future date', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'tok',
        refresh_token: 'rtok',
        expires_in: 3600,
      }),
    })

    const before = Date.now()
    const result = await exchangeCodeForTokens('code')
    expect(result.expiresAt.getTime()).toBeGreaterThan(before)
  })
})

describe('refreshAccessToken', () => {
  it('returns new accessToken and expiresAt', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-access-tok', expires_in: 3600 }),
    })

    const result = await refreshAccessToken('refresh-token')
    expect(result.accessToken).toBe('new-access-tok')
    expect(result.expiresAt).toBeInstanceOf(Date)
  })

  it('throws when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('token_expired'),
    })

    await expect(refreshAccessToken('bad-refresh')).rejects.toThrow('Token refresh failed')
  })
})
