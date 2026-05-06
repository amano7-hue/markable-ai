import { GoogleGenAI } from '@google/genai'
import type { LlmoEngineChecker, LlmoCheckResult } from './types'
import { extractDomain } from './types'

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

    console.log(`[Gemini] chunks=${chunks.length} text=${candidate?.content?.parts?.[0]?.text?.slice(0, 100)}`)

    const seen = new Set<string>()
    const citations: LlmoCheckResult['citations'] = []
    for (const chunk of chunks) {
      const url = chunk.web?.uri
      if (!url) continue
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
