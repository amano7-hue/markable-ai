export interface Ga4DailyRow {
  date: string // "YYYYMMDD"
  sessions: number
  users: number
  newUsers: number
  pageviews: number
  organicSessions: number
}

export interface Ga4Client {
  getDailyMetrics(propertyId: string, days: number): Promise<Ga4DailyRow[]>
}

export interface StoredGa4Connection {
  tenantId: string
  propertyId: string
  email: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
}
