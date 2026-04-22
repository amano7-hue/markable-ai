export type { SerankingClient, SerankingCitation, SerankingPromptResult, SerankingEngine } from './types'
export { SerankingHttpClient } from './client'
export { SerankingMockClient } from './mock-client'

import { SerankingHttpClient } from './client'
import { SerankingMockClient } from './mock-client'
import type { SerankingClient } from './types'

export function getSerankingClient(): SerankingClient {
  const apiKey = process.env.SERANKING_API_KEY
  if (apiKey) {
    return new SerankingHttpClient(apiKey)
  }
  return new SerankingMockClient()
}
