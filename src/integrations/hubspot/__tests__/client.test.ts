import { describe, it, expect } from 'vitest'
import { HubSpotMockClient } from '../mock-client'
import { HubSpotHttpClient } from '../client'
import { getHubSpotClient } from '../index'

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
