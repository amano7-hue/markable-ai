import type { GscClient, GscSearchRow } from './types'

interface GscApiRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export class GscHttpClient implements GscClient {
  constructor(private accessToken: string) {}

  async searchAnalytics(
    siteUrl: string,
    startDate: string,
    endDate: string,
  ): Promise<GscSearchRow[]> {
    const encodedSite = encodeURIComponent(siteUrl)
    const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['query', 'date'],
        rowLimit: 1000,
      }),
    })

    if (!res.ok) {
      throw new Error(`GSC API error: ${res.status} ${await res.text()}`)
    }

    const data = (await res.json()) as { rows?: GscApiRow[] }
    const rows = data.rows ?? []

    return rows.map((row) => ({
      keyword: row.keys[0] ?? '',
      date: row.keys[1] ?? '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }))
  }
}
