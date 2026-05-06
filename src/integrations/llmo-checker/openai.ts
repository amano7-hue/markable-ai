import type { LlmoEngineChecker, LlmoCheckResult } from './types'
import { extractDomain } from './types'

interface UrlCitationAnnotation {
  type: 'url_citation'
  url_citation: {
    url: string
    title?: string
    start_index?: number
    end_index?: number
  }
}

interface OpenAIMessage {
  content: string
  annotations?: UrlCitationAnnotation[]
}

interface OpenAIResponse {
  choices: Array<{ message: OpenAIMessage }>
  error?: { message: string }
}

export class OpenAIChecker implements LlmoEngineChecker {
  readonly engine = 'chatgpt' as const

  constructor(private readonly apiKey: string) {}

  async check(promptText: string, date: string): Promise<LlmoCheckResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-search-preview',
        messages: [{ role: 'user', content: promptText }],
        web_search_options: { search_context_size: 'medium' },
      }),
    })

    const data = (await res.json()) as OpenAIResponse

    if (!res.ok) {
      throw new Error(`OpenAI API ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`)
    }

    const message = data.choices[0]?.message
    const annotations = message?.annotations ?? []

    console.log(`[OpenAI] annotations=${annotations.length} content=${message?.content?.slice(0, 100)}`)

    // url_citation アノテーションを順番に抽出（重複 URL はスキップ）
    const seen = new Set<string>()
    const citations: LlmoCheckResult['citations'] = []
    for (const ann of annotations) {
      if (ann.type !== 'url_citation') continue
      const url = ann.url_citation.url
      if (seen.has(url)) continue
      seen.add(url)
      citations.push({
        domain: extractDomain(url),
        url,
        rank: citations.length + 1,
      })
    }

    return {
      engine: this.engine,
      promptText,
      snapshotDate: date,
      citations,
      rawResponse: message?.content,
    }
  }
}
