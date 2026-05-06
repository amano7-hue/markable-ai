import type { SerankingClient, SerankingProject, SerankingPromptResult, SerankingCitation } from './types'

export class SerankingHttpClient implements SerankingClient {
  private readonly baseUrl = 'https://api4.seranking.com'

  constructor(private readonly apiKey: string) {}

  private headers() {
    return {
      Authorization: `Token ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...options?.headers },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Seranking API ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  async listProjects(): Promise<SerankingProject[]> {
    const data = await this.request<Array<{ id: number | string; title?: string; name?: string }>>('/sites')
    return data.map((p) => ({ id: String(p.id), name: p.title ?? p.name ?? String(p.id) }))
  }

  /** サイトに設定済みの LLM エンジン一覧を取得 */
  async listLlmEngines(siteId: string): Promise<Array<{ id: string; name: string }>> {
    const data = await this.request<Array<{ id: number | string; name?: string; llm?: string }>>(`/sites/${siteId}/airt/llm`)
    return data.map((e) => ({ id: String(e.id), name: e.name ?? e.llm ?? String(e.id) }))
  }

  /** プロンプトを全 LLM エンジンに登録し、最初の LLM の promptId を返す */
  async createPrompt(siteId: string, text: string): Promise<string> {
    const engines = await this.listLlmEngines(siteId)
    if (engines.length === 0) throw new Error('LLM エンジンが設定されていません')

    const results: string[] = []
    for (const engine of engines) {
      const data = await this.request<{ prompts?: (number | string)[] }>(
        `/sites/${siteId}/airt/llm/${engine.id}/prompts`,
        {
          method: 'POST',
          body: JSON.stringify({ prompts: [text] }),
        },
      )
      if (data.prompts?.[0]) results.push(String(data.prompts[0]))
    }
    // 最初の LLM のプロンプト ID を代表 ID として返す
    return results[0] ?? text
  }

  async getPromptResults(
    siteId: string,
    _promptIds: string[],
    date: string,
  ): Promise<SerankingPromptResult[]> {
    const engines = await this.listLlmEngines(siteId)
    const results: SerankingPromptResult[] = []

    for (const engine of engines) {
      try {
        const data = await this.request<unknown>(
          `/sites/${siteId}/airt/llm/${engine.id}/prompts/rankings?date_from=${date}&date_to=${date}`,
        )

        // レスポンス形式を確認するためにログ出力（初回接続時のデバッグ用）
        console.log(`[Seranking] engine=${engine.name} response:`, JSON.stringify(data).slice(0, 500))

        const rows = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? []
        for (const row of rows as Array<Record<string, unknown>>) {
          const promptText = String(row.prompt ?? row.prompt_text ?? row.query ?? '')
          const promptId = String(row.prompt_id ?? row.id ?? promptText)
          const engineKey = normalizeEngine(engine.name)
          if (!engineKey) continue

          // citations / results / mentions など複数の形式に対応
          const citationRaw =
            (row.citations as unknown[]) ??
            (row.results as unknown[]) ??
            (row.mentions as unknown[]) ??
            []

          const citations: SerankingCitation[] = citationRaw
            .map((c, idx) => {
              const obj = c as Record<string, unknown>
              const domain =
                String(obj.domain ?? obj.url ?? obj.source ?? '')
                  .replace(/^https?:\/\//, '')
                  .split('/')[0]
              const rank = Number(obj.rank ?? obj.position ?? obj.pos ?? idx + 1)
              return domain ? { domain, rank } : null
            })
            .filter((c): c is SerankingCitation => c !== null)

          results.push({
            promptId,
            promptText,
            engine: engineKey,
            snapshotDate: date,
            citations,
            rawResponse: JSON.stringify(row),
          })
        }
      } catch (e) {
        console.error(`[Seranking] engine=${engine.name} error:`, e)
      }
    }

    return results
  }
}

const ENGINE_ALIASES: Record<string, SerankingPromptResult['engine']> = {
  chatgpt: 'chatgpt',
  'chat gpt': 'chatgpt',
  openai: 'chatgpt',
  perplexity: 'perplexity',
  gemini: 'gemini',
  google: 'google_ai_overview',
  'google ai': 'google_ai_overview',
  'google ai overview': 'google_ai_overview',
  'ai overview': 'google_ai_overview',
}

function normalizeEngine(name: string): SerankingPromptResult['engine'] | null {
  const key = name.toLowerCase().trim()
  for (const [alias, engine] of Object.entries(ENGINE_ALIASES)) {
    if (key.includes(alias)) return engine
  }
  return null
}
