import { describe, it, expect } from 'vitest'
import { HubSpotMockClient } from '../mock-client'
import { getHubSpotClient } from '../index'

describe('HubSpotMockClient', () => {
  const client = new HubSpotMockClient()

  it('getContacts returns 20 mock contacts', async () => {
    const contacts = await client.getContacts()
    expect(contacts).toHaveLength(20)
  })

  it('each contact has required fields', async () => {
    const contacts = await client.getContacts()
    for (const c of contacts) {
      expect(typeof c.id).toBe('string')
      expect(typeof c.email).toBe('string')
      expect(c.email).toContain('@')
    }
  })

  it('contacts have diverse lifecycle stages', async () => {
    const contacts = await client.getContacts()
    const stages = new Set(contacts.map((c) => c.lifecycle))
    expect(stages.size).toBeGreaterThan(1)
  })

  it('testConnection returns mock portal id', async () => {
    const result = await client.testConnection()
    expect(result.portalId).toBeTruthy()
    expect(typeof result.portalId).toBe('string')
  })
})

describe('getHubSpotClient', () => {
  it('returns mock client when no connection', () => {
    const client = getHubSpotClient(null)
    expect(client).toBeInstanceOf(HubSpotMockClient)
  })

  it('returns mock client when connection has no apiKey', () => {
    const client = getHubSpotClient({ apiKey: '' })
    expect(client).toBeInstanceOf(HubSpotMockClient)
  })

  it('returns real client when apiKey is present', async () => {
    const { HubSpotHttpClient } = await import('../client')
    const client = getHubSpotClient({ apiKey: 'pat-na1-test' })
    expect(client).toBeInstanceOf(HubSpotHttpClient)
  })
})
