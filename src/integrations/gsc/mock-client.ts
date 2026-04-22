import type { GscClient, GscSearchRow } from './types'

const MOCK_KEYWORDS = [
  { keyword: 'BtoBマーケティング自動化', basePosition: 8.2 },
  { keyword: 'マーケティングオートメーション 比較', basePosition: 14.5 },
  { keyword: 'AEO対策 ツール', basePosition: 23.1 },
  { keyword: 'AI検索対策', basePosition: 5.7 },
  { keyword: 'コンテンツマーケティング 効果測定', basePosition: 18.3 },
  { keyword: 'リードナーチャリング ツール', basePosition: 11.2 },
  { keyword: 'SEO 自動化', basePosition: 28.4 },
  { keyword: 'マーケティング ROI 改善', basePosition: 33.6 },
  { keyword: 'BtoB SaaS マーケティング', basePosition: 7.1 },
  { keyword: 'コンテンツ SEO 戦略', basePosition: 16.8 },
]

export class GscMockClient implements GscClient {
  async searchAnalytics(
    _siteUrl: string,
    startDate: string,
    endDate: string,
  ): Promise<GscSearchRow[]> {
    const rows: GscSearchRow[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10)

      for (const kw of MOCK_KEYWORDS) {
        const jitter = (Math.sin(d.getTime() + kw.keyword.length) + 1) / 2
        const position = Math.max(1, kw.basePosition + (jitter - 0.5) * 4)
        const impressions = Math.floor(50 + jitter * 200)
        const ctr = Math.max(0.01, 0.15 - position * 0.005)
        const clicks = Math.floor(impressions * ctr)

        rows.push({
          keyword: kw.keyword,
          date: dateStr,
          clicks,
          impressions,
          ctr,
          position,
        })
      }
    }

    return rows
  }
}
