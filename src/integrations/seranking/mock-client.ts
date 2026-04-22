import type { SerankingClient, SerankingPromptResult } from './types'

const ENGINES = [
  'chatgpt',
  'perplexity',
  'gemini',
  'google_ai_overview',
] as const

const MOCK_COMPETITORS = [
  'hubspot.com',
  'salesforce.com',
  'marketo.com',
  'pardot.com',
]

export class SerankingMockClient implements SerankingClient {
  async getPromptResults(
    _projectId: string,
    promptIds: string[],
    date: string,
  ): Promise<SerankingPromptResult[]> {
    const results: SerankingPromptResult[] = []

    for (const promptId of promptIds) {
      for (const engine of ENGINES) {
        // ランダムシードをプロンプトID+エンジンから生成して再現性確保
        const seed = [...promptId, engine].reduce(
          (acc, c) => acc + c.charCodeAt(0),
          0,
        )
        const shuffled = [...MOCK_COMPETITORS].sort(
          () => Math.sin(seed) - 0.5,
        )

        results.push({
          promptId,
          promptText: `Mock prompt ${promptId}`,
          engine,
          snapshotDate: date,
          citations: shuffled.slice(0, 3).map((domain, idx) => ({
            domain,
            rank: idx + 1,
          })),
        })
      }
    }

    return results
  }
}
