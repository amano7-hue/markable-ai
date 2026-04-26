export interface KeywordWithStats {
  id: string
  tenantId: string
  text: string
  intent: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  latestPosition: number | null
  previousPosition: number | null // second-latest snapshot for trend
  latestClicks: number | null
  latestImpressions: number | null
  latestCtr: number | null
  lastSyncedAt: Date | null
}

export interface TopOpportunity {
  keywordId: string
  keyword: string
  position: number
  impressions: number
  clicks: number
  ctr: number
  snapshotDate: Date
}

export interface SeoArticlePayload {
  keywordId: string | null
  keywordText: string | null
  title: string
  brief: string
  draft: string
  generatedAt: string
}
