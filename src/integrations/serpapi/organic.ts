/**
 * SerpAPI — 有機検索結果・関連質問取得
 * 競合記事URLの収集と、ユーザーニーズ（PAA）の実データ取得に使用する
 */

export interface OrganicResult {
  position: number
  title: string
  link: string
  snippet: string | null
  displayedLink: string | null
}

export interface RelatedQuestion {
  question: string
  snippet: string | null
}

export interface OrganicSearchResult {
  organicResults: OrganicResult[]
  relatedQuestions: RelatedQuestion[]
  relatedSearches: string[]
}

interface SerpApiOrganicItem {
  position?: number
  title?: string
  link?: string
  snippet?: string
  displayed_link?: string
}

interface SerpApiRelatedQuestion {
  question?: string
  snippet?: string
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicItem[]
  related_questions?: SerpApiRelatedQuestion[]
  related_searches?: Array<{ query?: string }>
  error?: string
}

/**
 * 指定キーワードの日本語Google検索結果上位10件を取得する
 */
export async function fetchOrganicResults(
  keyword: string,
  apiKey: string,
  limit = 10,
): Promise<OrganicSearchResult> {
  const params = new URLSearchParams({
    q: keyword,
    api_key: apiKey,
    engine: 'google',
    hl: 'ja',
    gl: 'jp',
    num: String(limit),
  })

  const res = await fetch(`https://serpapi.com/search.json?${params}`, {
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SerpAPI ${res.status}: ${text}`)
  }

  const data = (await res.json()) as SerpApiResponse
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`)

  const organicResults: OrganicResult[] = (data.organic_results ?? [])
    .slice(0, limit)
    .map((item) => ({
      position: item.position ?? 0,
      title: item.title ?? '',
      link: item.link ?? '',
      snippet: item.snippet ?? null,
      displayedLink: item.displayed_link ?? null,
    }))
    .filter((r) => r.link.startsWith('http'))

  const relatedQuestions: RelatedQuestion[] = (data.related_questions ?? [])
    .slice(0, 8)
    .map((q) => ({
      question: q.question ?? '',
      snippet: q.snippet ?? null,
    }))
    .filter((q) => q.question)

  const relatedSearches: string[] = (data.related_searches ?? [])
    .map((r) => r.query ?? '')
    .filter(Boolean)
    .slice(0, 8)

  return { organicResults, relatedQuestions, relatedSearches }
}
