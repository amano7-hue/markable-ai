import { describe, it, expect, vi } from 'vitest'
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
      expiresAt: new Date(Date.now() + 3600_000), // 1 hour from now
    })
    expect(client).toBeInstanceOf(GscHttpClient)
  })

  it('refreshes token when expired and returns http client', async () => {
    const { refreshAccessToken } = await import('../oauth')
    const { getGscClient } = await import('../index')

    const client = await getGscClient({
      accessToken: 'expired-token',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    })

    expect(refreshAccessToken).toHaveBeenCalledWith('old-refresh')
    expect(client).toBeInstanceOf(GscHttpClient)
  })
})
