export type LlmoEngine = 'chatgpt' | 'perplexity' | 'gemini' | 'google_ai_overview'

export interface LlmoCitation {
  domain: string
  url: string
  rank: number
}

export interface LlmoCheckResult {
  engine: LlmoEngine
  promptText: string
  snapshotDate: string // ISO "YYYY-MM-DD"
  citations: LlmoCitation[]
  rawResponse?: string
}

export interface LlmoEngineChecker {
  engine: LlmoEngine
  check(promptText: string, date: string): Promise<LlmoCheckResult>
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '')
  }
}
