export interface GscSearchRow {
  keyword: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  date: string // "YYYY-MM-DD"
}

export interface GscClient {
  searchAnalytics(
    siteUrl: string,
    startDate: string,
    endDate: string,
  ): Promise<GscSearchRow[]>
}
