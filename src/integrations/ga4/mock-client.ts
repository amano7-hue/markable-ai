import type { Ga4Client, Ga4DailyRow } from './types'

export class Ga4MockClient implements Ga4Client {
  async getDailyMetrics(_propertyId: string, days: number): Promise<Ga4DailyRow[]> {
    const rows: Ga4DailyRow[] = []
    const today = new Date()

    for (let i = days; i >= 1; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '')

      // 上昇トレンドのある擬似データ
      const base = 80 + Math.floor((days - i) * 1.5)
      const jitter = () => Math.floor(Math.random() * 20) - 10
      const sessions = base + jitter()
      const users = Math.floor(sessions * 0.85)
      const newUsers = Math.floor(users * 0.6)
      const pageviews = Math.floor(sessions * 2.3)
      const organicSessions = Math.floor(sessions * 0.42)

      rows.push({
        date: dateStr,
        sessions: Math.max(sessions, 10),
        users: Math.max(users, 8),
        newUsers: Math.max(newUsers, 4),
        pageviews: Math.max(pageviews, 20),
        organicSessions: Math.max(organicSessions, 4),
      })
    }

    return rows
  }
}
