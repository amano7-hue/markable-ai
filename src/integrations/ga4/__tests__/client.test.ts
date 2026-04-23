import { describe, it, expect, vi } from 'vitest'
import { Ga4MockClient } from '../mock-client'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ga4Connection: { update: vi.fn() },
  },
}))

vi.mock('../oauth', () => ({
  refreshAccessToken: vi.fn(),
  getGa4AuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
}))

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
})
