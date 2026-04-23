import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GscMockClient } from '../mock-client'
import { GscHttpClient } from '../client'

vi.mock('../oauth', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue({
    accessToken: 'refreshed-token',
    refreshToken: 'new-refresh',
    expiresAt: new Date(Date.now() + 3600_000),
  }),
  getGscAuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

// ─── getGscClient factory ─────────────────────────────────────────────────────

describe('getGscClient', () => {
  it('returns mock client when connection is null', async () => {
    const { getGscClient } = await import('../index')
    const client = await getGscClient(null)
    expect(client).toBeInstanceOf(GscMockClient)
  })

  it('returns mock client when connection is undefined', async () => {
    const { getGscClient } = await import('../index')
    const client = await getGscClient(undefined)
    expect(client).toBeInstanceOf(GscMockClient)
  })

  it('returns http client when connection is valid and not expired', async () => {
    const { getGscClient } = await import('../index')
    const client = await getGscClient({
      accessToken: 'valid-token',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 3600_000),
    })
    expect(client).toBeInstanceOf(GscHttpClient)
  })

  it('refreshes token when expired and returns http client', async () => {
    const { refreshAccessToken } = await import('../oauth')
    const { getGscClient } = await import('../index')

    const client = await getGscClient({
      accessToken: 'expired-token',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() - 1000),
    })

    expect(refreshAccessToken).toHaveBeenCalledWith('old-refresh')
    expect(client).toBeInstanceOf(GscHttpClient)
  })
})

// ─── GscHttpClient.searchAnalytics ───────────────────────────────────────────

describe('GscHttpClient.searchAnalytics', () => {
  function makeRow(keyword: string, date: string, clicks = 10, impressions = 100, ctr = 0.1, position = 5): object {
    return { keys: [keyword, date], clicks, impressions, ctr, position }
  }

  it('returns mapped rows on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        rows: [makeRow('next.js tutorial', '2026-04-01', 15, 200, 0.075, 3.2)],
      }),
    })

    const client = new GscHttpClient('token')
    const result = await client.searchAnalytics('https://example.com', '2026-03-01', '2026-04-01')
    expect(result).toHaveLength(1)
    expect(result[0].keyword).toBe('next.js tutorial')
    expect(result[0].date).toBe('2026-04-01')
    expect(result[0].clicks).toBe(15)
    expect(result[0].impressions).toBe(200)
    expect(result[0].ctr).toBe(0.075)
    expect(result[0].position).toBe(3.2)
  })

  it('returns empty array when no rows', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    })

    const client = new GscHttpClient('token')
    const result = await client.searchAnalytics('https://example.com', '2026-03-01', '2026-04-01')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when rows field is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    const client = new GscHttpClient('token')
    const result = await client.searchAnalytics('https://example.com', '2026-03-01', '2026-04-01')
    expect(result).toHaveLength(0)
  })

  it('throws on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('forbidden'),
    })

    const client = new GscHttpClient('token')
    await expect(client.searchAnalytics('https://example.com', '2026-03-01', '2026-04-01')).rejects.toThrow('GSC API error')
  })

  it('URL-encodes the siteUrl', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    })

    const client = new GscHttpClient('token')
    await client.searchAnalytics('https://example.com/', '2026-03-01', '2026-04-01')
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain(encodeURIComponent('https://example.com/'))
  })

  it('handles multiple rows', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        rows: [
          makeRow('keyword 1', '2026-04-01'),
          makeRow('keyword 2', '2026-04-01'),
          makeRow('keyword 1', '2026-04-02'),
        ],
      }),
    })

    const client = new GscHttpClient('token')
    const result = await client.searchAnalytics('https://example.com', '2026-03-01', '2026-04-01')
    expect(result).toHaveLength(3)
  })
})
