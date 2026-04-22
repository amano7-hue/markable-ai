import type { SerankingClient, SerankingPromptResult } from './types'

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

    // TODO: map real API response shape to SerankingPromptResult[]
    return (await res.json()) as SerankingPromptResult[]
  }
}
