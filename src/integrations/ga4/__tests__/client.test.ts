import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Ga4MockClient } from '../mock-client'
import { Ga4HttpClient } from '../client'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ga4Connection: { update: vi.fn() },
  },
}))

vi.mock('../oauth', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue({
    accessToken: 'refreshed-token',
    expiresAt: new Date(Date.now() + 3600_000),
  }),
  getGa4AuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

// ─── getGa4Client factory ─────────────────────────────────────────────────────

describe('getGa4Client fallback', () => {
  it('returns mock client when conn is null', async () => {
    const { getGa4Client } = await import('../client')
    const { client } = await getGa4Client(null)
    expect(client).toBeInstanceOf(Ga4MockClient)
  })

  it('returns mock client when conn is undefined', async () => {
    const { getGa4Client } = await import('../client')
    const { client } = await getGa4Client(undefined)
    expect(client).toBeInstanceOf(Ga4MockClient)
  })

  it('returns mock client when propertyId is empty string', async () => {
    const { getGa4Client } = await import('../client')
    const { client } = await getGa4Client({
      tenantId: 't1',
      accessToken: 'tok',
      refreshToken: 'ref',
      propertyId: '',
      expiresAt: new Date(Date.now() + 3600_000),
    })
    expect(client).toBeInstanceOf(Ga4MockClient)
  })

  it('returns mock propertyId when falling back', async () => {
    const { getGa4Client } = await import('../client')
    const { propertyId } = await getGa4Client(null)
    expect(propertyId).toBe('mock')
  })

  it('returns http client when connection is valid', async () => {
    const { getGa4Client } = await import('../client')
    const { client, propertyId } = await getGa4Client({
      tenantId: 't1',
      accessToken: 'valid-token',
      refreshToken: 'refresh',
      propertyId: '123456',
      expiresAt: new Date(Date.now() + 3600_000),
    })
    expect(client).toBeInstanceOf(Ga4HttpClient)
    expect(propertyId).toBe('123456')
  })

  it('refreshes token when expired', async () => {
    const { getGa4Client } = await import('../client')
    const { refreshAccessToken } = await import('../oauth')

    await getGa4Client({
      tenantId: 't1',
      accessToken: 'expired-token',
      refreshToken: 'old-refresh',
      propertyId: '123456',
      expiresAt: new Date(Date.now() - 1000),
    })

    expect(refreshAccessToken).toHaveBeenCalledWith('old-refresh')
  })
})

// ─── Ga4HttpClient.getDailyMetrics ────────────────────────────────────────────

describe('Ga4HttpClient.getDailyMetrics', () => {
  function makeRow(date: string, channel: string, sessions: number, users = 10, newUsers = 5, pageviews = 20): object {
    return {
      dimensionValues: [{ value: date }, { value: channel }],
      metricValues: [
        { value: String(sessions) },
        { value: String(users) },
        { value: String(newUsers) },
        { value: String(pageviews) },
      ],
    }
  }

  it('returns empty array when no rows', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    })

    const client = new Ga4HttpClient('token')
    const result = await client.getDailyMetrics('123456', 30)
    expect(result).toHaveLength(0)
  })

  it('returns empty array when rows field is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    const client = new Ga4HttpClient('token')
    const result = await client.getDailyMetrics('123456', 30)
    expect(result).toHaveLength(0)
  })

  it('aggregates multiple channels for same date', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        rows: [
          makeRow('20260101', 'Organic Search', 100),
          makeRow('20260101', 'Direct', 50),
        ],
      }),
    })

    const client = new Ga4HttpClient('token')
    const result = await client.getDailyMetrics('123456', 30)
    expect(result).toHaveLength(1)
    expect(result[0].sessions).toBe(150)
  })

  it('counts organic sessions separately', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        rows: [
          makeRow('20260101', 'Organic Search', 100),
          makeRow('20260101', 'Paid Search', 80),
          makeRow('20260101', 'Direct', 60),
        ],
      }),
    })

    const client = new Ga4HttpClient('token')
    const result = await client.getDailyMetrics('123456', 30)
    expect(result[0].organicSessions).toBe(100)
    expect(result[0].sessions).toBe(240)
  })

  it('returns one row per date', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        rows: [
          makeRow('20260101', 'Organic Search', 100),
          makeRow('20260102', 'Direct', 50),
          makeRow('20260103', 'Organic Search', 200),
        ],
      }),
    })

    const client = new Ga4HttpClient('token')
    const result = await client.getDailyMetrics('123456', 30)
    expect(result).toHaveLength(3)
  })

  it('throws on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('quota exceeded'),
    })

    const client = new Ga4HttpClient('token')
    await expect(client.getDailyMetrics('123456', 30)).rejects.toThrow('GA4 API error')
  })

  it('sends correct property ID in URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    })

    const client = new Ga4HttpClient('token')
    await client.getDailyMetrics('my-property-id', 30)
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('my-property-id')
  })
})
