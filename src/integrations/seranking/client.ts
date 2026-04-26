import type { SerankingClient, SerankingPromptResult, SerankingCitation } from './types'

/** Seranking AIRT API の実際のレスポンス形式 */
interface ApiCitation {
  domain?: string
  url?: string
  position?: number
  rank?: number
}

interface ApiPromptResult {
  prompt_id?: string
  promptId?: string
  prompt_text?: string
  promptText?: string
  engine?: string
  date?: string
  snapshotDate?: string
  snapshot_date?: string
  citations?: ApiCitation[]
  results?: ApiCitation[]
  raw_response?: string
  rawResponse?: string
}

function mapApiResult(item: ApiPromptResult): SerankingPromptResult | null {
  const promptId = item.prompt_id ?? item.promptId
  const engine = item.engine?.toLowerCase()
  if (!promptId || !engine) return null

  const citations: SerankingCitation[] = (item.citations ?? item.results ?? [])
    .filter((c) => c.domain ?? c.url)
    .map((c, idx) => ({
      domain: c.domain ?? new URL(c.url ?? 'https://unknown').hostname,
      rank: c.rank ?? c.position ?? idx + 1,
    }))

  return {
    promptId,
    promptText: item.prompt_text ?? item.promptText ?? '',
    engine: engine as SerankingPromptResult['engine'],
    snapshotDate: item.date ?? item.snapshot_date ?? item.snapshotDate ?? '',
    citations,
    rawResponse: item.raw_response ?? item.rawResponse,
  }
}

export class SerankingHttpClient implements SerankingClient {
  private readonly baseUrl = 'https://api.seranking.com/v1'

  constructor(private readonly apiKey: string) {}

  async getPromptResults(
    projectId: string,
    promptIds: string[],
    date: string,
  ): Promise<SerankingPromptResult[]> {
    const url = new URL(`${this.baseUrl}/ai-search/results`)
    url.searchParams.set('project_id', projectId)
    url.searchParams.set('date', date)
    for (const id of promptIds) {
      url.searchParams.append('prompt_ids[]', id)
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Seranking API error: ${res.status} ${await res.text()}`)
    }

    const raw = await res.json() as ApiPromptResult[]
    return raw.flatMap((item) => {
      const mapped = mapApiResult(item)
      return mapped ? [mapped] : []
    })
  }
}
