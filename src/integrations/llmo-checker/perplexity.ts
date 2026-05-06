import type { LlmoEngineChecker, LlmoCheckResult } from './types'
import { extractDomain } from './types'

interface PerplexityResponse {
  choices: Array<{ message: { content: string } }>
  citations?: string[]
}

export class PerplexityChecker implements LlmoEngineChecker {
  readonly engine = 'perplexity' as const

  constructor(private readonly apiKey: string) {}

  async check(promptText: string, date: string): Promise<LlmoCheckResult> {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: promptText }],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Perplexity API ${res.status}: ${text}`)
    }

    const data = (await res.json()) as PerplexityResponse
    const urls: string[] = data.citations ?? []

    const citations = urls.map((url, idx) => ({
      domain: extractDomain(url),
      url,
      rank: idx + 1,
    }))

    return {
      engine: this.engine,
      promptText,
      snapshotDate: date,
      citations,
      rawResponse: data.choices[0]?.message?.content,
    }
  }
}
