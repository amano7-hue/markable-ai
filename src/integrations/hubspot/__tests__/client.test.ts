import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HubSpotMockClient } from '../mock-client'
import { HubSpotHttpClient } from '../client'
import { getHubSpotClient } from '../index'

// ─── getHubSpotClient factory ─────────────────────────────────────────────────

describe('getHubSpotClient', () => {
  it('returns mock client when connection is null', () => {
    const client = getHubSpotClient(null)
    expect(client).toBeInstanceOf(HubSpotMockClient)
  })

  it('returns mock client when connection is undefined', () => {
    const client = getHubSpotClient(undefined)
    expect(client).toBeInstanceOf(HubSpotMockClient)
  })

  it('returns mock client when apiKey is empty string', () => {
    const client = getHubSpotClient({ apiKey: '' })
    expect(client).toBeInstanceOf(HubSpotMockClient)
  })

  it('returns http client when apiKey is provided', () => {
    const client = getHubSpotClient({ apiKey: 'pat-na1-test-key' })
    expect(client).toBeInstanceOf(HubSpotHttpClient)
  })
})

// ─── HubSpotHttpClient.testConnection ────────────────────────────────────────

describe('HubSpotHttpClient.testConnection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns portalId on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ portalId: 12345 }),
    })

    const client = new HubSpotHttpClient('test-key')
    const result = await client.testConnection()
    expect(result.portalId).toBe('12345')
  })

  it('converts numeric portalId to string', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ portalId: 99999 }),
    })

    const client = new HubSpotHttpClient('test-key')
    const result = await client.testConnection()
    expect(typeof result.portalId).toBe('string')
  })

  it('throws when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })

    const client = new HubSpotHttpClient('bad-key')
    await expect(client.testConnection()).rejects.toThrow('HubSpot auth failed: 401')
  })

  it('sends Authorization header with Bearer token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ portalId: 1 }),
    })

    const client = new HubSpotHttpClient('my-api-key')
    await client.testConnection()

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer my-api-key')
  })
})

// ─── HubSpotHttpClient.getContacts ───────────────────────────────────────────

describe('HubSpotHttpClient.getContacts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns contacts from single page', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { id: 'c1', properties: { email: 'user@example.com', firstname: 'John', lastname: 'Doe', company: 'Acme', jobtitle: 'CEO', lifecyclestage: 'lead', hs_lead_status: 'NEW' } },
        ],
        paging: undefined,
      }),
    })

    const client = new HubSpotHttpClient('key')
    const contacts = await client.getContacts(100)
    expect(contacts).toHaveLength(1)
    expect(contacts[0].email).toBe('user@example.com')
    expect(contacts[0].firstName).toBe('John')
    expect(contacts[0].jobTitle).toBe('CEO')
  })

  it('skips contacts without email', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { id: 'c1', properties: { email: 'user@example.com' } },
          { id: 'c2', properties: {} }, // no email
        ],
      }),
    })

    const client = new HubSpotHttpClient('key')
    const contacts = await client.getContacts(100)
    expect(contacts).toHaveLength(1)
  })

  it('paginates until no next cursor', async () => {
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [{ id: 'c1', properties: { email: 'a@example.com' } }],
            paging: { next: { after: 'cursor-1' } },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          results: [{ id: 'c2', properties: { email: 'b@example.com' } }],
          paging: undefined,
        }),
      })
    })

    const client = new HubSpotHttpClient('key')
    const contacts = await client.getContacts(500)
    expect(contacts).toHaveLength(2)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('throws when API returns error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 })

    const client = new HubSpotHttpClient('key')
    await expect(client.getContacts()).rejects.toThrow('HubSpot API error: 403')
  })
})
