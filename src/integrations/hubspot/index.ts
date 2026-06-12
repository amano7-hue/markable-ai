export type { HubSpotClient, HubSpotContact } from './types'
export { HubSpotHttpClient } from './client'
export { HubSpotMockClient } from './mock-client'
export type { HubSpotImportFilter } from './client'

import { HubSpotHttpClient } from './client'
import { HubSpotMockClient } from './mock-client'
import type { HubSpotClient } from './types'
import type { HubSpotImportFilter } from './client'

interface StoredConnection {
  apiKey: string
  importFilter?: HubSpotImportFilter | null
}

export function getHubSpotClient(connection?: StoredConnection | null): HubSpotClient {
  if (connection?.apiKey) {
    return new HubSpotHttpClient(connection.apiKey, connection.importFilter ?? undefined)
  }
  return new HubSpotMockClient()
}
