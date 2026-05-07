import type { LlmoEngineChecker, LlmoCheckResult } from './types'
import { extractDomain } from './types'

interface SerpApiSource {
  title?: string
  link?: string
}

interface SerpApiTextBlock {
  snippet?: string
  sources?: SerpApiSource[]
}

interface SerpApiResponse {
  ai_overview?: {
    text_blocks?: SerpApiTextBlock[]
    references?: SerpApiSource[]
  }
  error?: string
}

export class GoogleAiOverviewChecker implements LlmoEngineChecker {
  readonly engine = 'google_ai_overview' as const

  constructor(private readonly apiKey: string) {}

  async check(promptText: string, date: string): Promise<LlmoCheckResult> {
    const params = new URLSearchParams({
      q: promptText,
      api_key: this.apiKey,
      engine: 'google',
      hl: 'ja',
      gl: 'jp',
      num: '5',
    })

    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`SerpAPI ${res.status}: ${text}`)
    }

    const data = (await res.json()) as SerpApiResponse

    if (data.error) throw new Error(`SerpAPI error: ${data.error}`)

    // sources は text_blocks と references の両方に存在する場合がある
    const rawSources: SerpApiSource[] = [
      ...(data.ai_overview?.text_blocks?.flatMap((b) => b.sources ?? []) ?? []),
      ...(data.ai_overview?.references ?? []),
    ]

    // 重複 URL を排除しつつ順番を保持
    const seen = new Set<string>()
    const citations: LlmoCheckResult['citations'] = []
    for (const src of rawSources) {
      const url = src.link
      if (!url) continue
      if (seen.has(url)) continue
      seen.add(url)
      citations.push({
        domain: extractDomain(url),
        url,
        rank: citations.length + 1,
      })
    }

    console.log(`[GoogleAIO] citations=${citations.length} query="${promptText.slice(0, 50)}"`)

    return {
      engine: this.engine,
      promptText,
      snapshotDate: date,
      citations,
    }
  }
}
