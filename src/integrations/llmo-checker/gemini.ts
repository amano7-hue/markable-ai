import { GoogleGenAI } from '@google/genai'
import type { LlmoEngineChecker, LlmoCheckResult } from './types'
import { extractDomain } from './types'

/** Gemini のグラウンディングは vertexaisearch.cloud.google.com のリダイレクト URL を返すため、
 *  実際の URL に解決してからドメインを抽出する */
async function resolveRedirect(url: string): Promise<string> {
  if (!url.includes('vertexaisearch.cloud.google.com')) return url
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
    })
    return res.url || url
  } catch {
    return url
  }
}

export class GeminiChecker implements LlmoEngineChecker {
  readonly engine = 'gemini' as const
  private readonly genai: GoogleGenAI

  constructor(apiKey: string) {
    this.genai = new GoogleGenAI({ apiKey })
  }

  async check(promptText: string, date: string): Promise<LlmoCheckResult> {
    const result = await this.genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })

    const candidate = result.candidates?.[0]
    const chunks = candidate?.groundingMetadata?.groundingChunks ?? []

    // リダイレクト URL を並列解決
    const rawUrls = chunks.map((c) => c.web?.uri).filter((u): u is string => !!u)
    const resolvedUrls = await Promise.all(rawUrls.map(resolveRedirect))

    console.log(`[Gemini] chunks=${chunks.length} resolved sample=${resolvedUrls[0] ?? 'none'}`)

    const seen = new Set<string>()
    const citations: LlmoCheckResult['citations'] = []
    for (const url of resolvedUrls) {
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
      rawResponse: candidate?.content?.parts?.[0]?.text ?? undefined,
    }
  }
}
