import type { LlmoEngineChecker, LlmoCheckResult } from './types'
import { PerplexityChecker } from './perplexity'
import { OpenAIChecker } from './openai'
import { GeminiChecker } from './gemini'

export type { LlmoCheckResult, LlmoEngine, LlmoCitation } from './types'

export class DirectLlmoChecker {
  private readonly checkers: LlmoEngineChecker[]

  constructor(checkers: LlmoEngineChecker[]) {
    this.checkers = checkers
  }

  /** 全エンジンで並列チェック。失敗したエンジンはスキップしてログ出力 */
  async checkAll(promptText: string, date: string): Promise<LlmoCheckResult[]> {
    const results = await Promise.allSettled(
      this.checkers.map((c) => c.check(promptText, date)),
    )
    return results.flatMap((r, i) => {
      if (r.status === 'fulfilled') return [r.value]
      console.error(`[LlmoChecker] ${this.checkers[i].engine} failed:`, r.reason)
      return []
    })
  }
}

/** 環境変数から利用可能なチェッカーを組み立てる */
export function buildDirectLlmoChecker(): DirectLlmoChecker {
  const checkers: LlmoEngineChecker[] = []

  if (process.env.PERPLEXITY_API_KEY) {
    checkers.push(new PerplexityChecker(process.env.PERPLEXITY_API_KEY))
  }
  if (process.env.OPENAI_API_KEY) {
    checkers.push(new OpenAIChecker(process.env.OPENAI_API_KEY))
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    checkers.push(new GeminiChecker(process.env.GOOGLE_GENERATIVE_AI_API_KEY))
  }

  return new DirectLlmoChecker(checkers)
}
