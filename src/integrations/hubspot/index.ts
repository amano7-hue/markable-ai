export type { HubSpotClient, HubSpotContact } from './types'
export { HubSpotHttpClient } from './client'
export { HubSpotMockClient } from './mock-client'

import { HubSpotHttpClient } from './client'
import { HubSpotMockClient } from './mock-client'
import type { HubSpotClient } from './types'

interface StoredConnection {
  apiKey: string
}

export function getHubSpotClient(connection?: StoredConnection | null): HubSpotClient {
  if (connection?.apiKey) {
    return new HubSpotHttpClient(connection.apiKey)
  }
  return new HubSpotMockClient()
}
