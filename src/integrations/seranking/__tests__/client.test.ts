import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { SerankingHttpClient } from '../client'

// ─── getSerankingClient factory ───────────────────────────────────────────────

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
    const { SerankingHttpClient: HttpClient } = await import('../client')
    const client = getSerankingClient()
    expect(client).toBeInstanceOf(HttpClient)
  })

  it('returns mock client when SERANKING_API_KEY is empty string', async () => {
    process.env.SERANKING_API_KEY = ''
    const { getSerankingClient } = await import('../index')
    const { SerankingMockClient } = await import('../mock-client')
    const client = getSerankingClient()
    expect(client).toBeInstanceOf(SerankingMockClient)
  })
})

// ─── SerankingHttpClient.getPromptResults ────────────────────────────────────

describe('SerankingHttpClient.getPromptResults', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns API results on success', async () => {
    const mockResults = [{ promptId: 'p1', results: [] }]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResults),
    })

    const client = new SerankingHttpClient('api-key')
    const result = await client.getPromptResults('project-1', ['p1'], '2026-04-23')
    expect(result).toEqual(mockResults)
  })

  it('includes project_id in request URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const client = new SerankingHttpClient('api-key')
    await client.getPromptResults('my-project', ['p1'], '2026-04-23')
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('project_id=my-project')
  })

  it('includes all prompt_ids as array params', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const client = new SerankingHttpClient('api-key')
    await client.getPromptResults('proj', ['p1', 'p2', 'p3'], '2026-04-23')
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('prompt_ids%5B%5D=p1')
    expect(url).toContain('prompt_ids%5B%5D=p2')
    expect(url).toContain('prompt_ids%5B%5D=p3')
  })

  it('sends Token authorization header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const client = new SerankingHttpClient('my-seranking-key')
    await client.getPromptResults('proj', ['p1'], '2026-04-23')
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(options.headers.Authorization).toBe('Token my-seranking-key')
  })

  it('throws on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('rate limit exceeded'),
    })

    const client = new SerankingHttpClient('api-key')
    await expect(client.getPromptResults('proj', ['p1'], '2026-04-23')).rejects.toThrow('Seranking API error: 429')
  })
})
