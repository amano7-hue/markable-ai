import { describe, it, expect, vi, afterEach } from 'vitest'

describe('getSerankingClient', () => {
  const originalEnv = process.env.SERANKING_API_KEY

  afterEach(() => {
    process.env.SERANKING_API_KEY = originalEnv
    vi.resetModules()
  })

  it('returns mock client when SERANKING_API_KEY is not set', async () => {
    delete process.env.SERANKING_API_KEY
    const { getSerankingClient } = await import('../index')
    const { SerankingMockClient } = await import('../mock-client')
    const client = getSerankingClient()
    expect(client).toBeInstanceOf(SerankingMockClient)
  })

  it('returns http client when SERANKING_API_KEY is set', async () => {
    process.env.SERANKING_API_KEY = 'test-api-key-123'
    const { getSerankingClient } = await import('../index')
    const { SerankingHttpClient } = await import('../client')
    const client = getSerankingClient()
    expect(client).toBeInstanceOf(SerankingHttpClient)
  })

  it('returns mock client when SERANKING_API_KEY is empty string', async () => {
    process.env.SERANKING_API_KEY = ''
    const { getSerankingClient } = await import('../index')
    const { SerankingMockClient } = await import('../mock-client')
    const client = getSerankingClient()
    expect(client).toBeInstanceOf(SerankingMockClient)
  })
})
