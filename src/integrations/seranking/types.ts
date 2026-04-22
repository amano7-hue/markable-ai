export type SerankingEngine =
  | 'chatgpt'
  | 'perplexity'
  | 'gemini'
  | 'google_ai_overview'

export interface SerankingCitation {
  domain: string
  rank: number
}

export interface SerankingPromptResult {
  promptId: string
  promptText: string
  engine: SerankingEngine
  snapshotDate: string // ISO date "YYYY-MM-DD"
  citations: SerankingCitation[]
  rawResponse?: string
}

export interface SerankingClient {
  getPromptResults(
    projectId: string,
    promptIds: string[],
    date: string,
  ): Promise<SerankingPromptResult[]>
}
