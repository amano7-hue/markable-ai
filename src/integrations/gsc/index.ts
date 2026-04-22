export type { GscClient, GscSearchRow } from './types'
export { GscHttpClient } from './client'
export { GscMockClient } from './mock-client'
export { getGscAuthUrl, exchangeCodeForTokens, refreshAccessToken } from './oauth'
export type { TokenResult } from './oauth'

import { GscHttpClient } from './client'
import { GscMockClient } from './mock-client'
import { refreshAccessToken } from './oauth'
import type { GscClient } from './types'

interface StoredConnection {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export async function getGscClient(
  connection?: StoredConnection | null,
): Promise<GscClient> {
  if (!connection) {
    return new GscMockClient()
  }

  // トークン期限切れなら自動更新
  let { accessToken } = connection
  if (new Date() >= connection.expiresAt) {
    const refreshed = await refreshAccessToken(connection.refreshToken)
    accessToken = refreshed.accessToken
  }

  return new GscHttpClient(accessToken)
}
