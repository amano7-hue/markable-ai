import { refreshAccessToken } from './oauth'
import type { Ga4Client, Ga4DailyRow, StoredGa4Connection } from './types'
import { prisma } from '@/lib/db/client'

interface ReportRow {
  dimensionValues: { value: string }[]
  metricValues: { value: string }[]
}

export class Ga4HttpClient implements Ga4Client {
  constructor(private accessToken: string) {}

  async getDailyMetrics(propertyId: string, days: number): Promise<Ga4DailyRow[]> {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }],
          dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGrouping' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
            { name: 'screenPageViews' },
          ],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
      },
    )

    if (!res.ok) throw new Error(`GA4 API error: ${await res.text()}`)

    const data = (await res.json()) as { rows?: ReportRow[] }
    if (!data.rows) return []

    // date → channel → metrics マップに集約
    const byDate = new Map<
      string,
      { sessions: number; users: number; newUsers: number; pageviews: number; organicSessions: number }
    >()

    for (const row of data.rows) {
      const date = row.dimensionValues[0].value
      const channel = row.dimensionValues[1].value
      const sessions = parseInt(row.metricValues[0].value, 10)
      const users = parseInt(row.metricValues[1].value, 10)
      const newUsers = parseInt(row.metricValues[2].value, 10)
      const pageviews = parseInt(row.metricValues[3].value, 10)

      const existing = byDate.get(date) ?? {
        sessions: 0, users: 0, newUsers: 0, pageviews: 0, organicSessions: 0,
      }

      existing.sessions += sessions
      existing.users += users
      existing.newUsers += newUsers
      existing.pageviews += pageviews
      if (channel === 'Organic Search') existing.organicSessions += sessions

      byDate.set(date, existing)
    }

    return Array.from(byDate.entries()).map(([date, metrics]) => ({
      date,
      ...metrics,
    }))
  }
}

export async function getGa4Client(
  conn: StoredGa4Connection | null | undefined,
): Promise<{ client: Ga4Client; propertyId: string }> {
  if (!conn || !conn.propertyId) {
    const { Ga4MockClient } = await import('./mock-client')
    return { client: new Ga4MockClient(), propertyId: 'mock' }
  }

  let accessToken = conn.accessToken
  if (new Date(conn.expiresAt) <= new Date()) {
    const refreshed = await refreshAccessToken(conn.refreshToken)
    accessToken = refreshed.accessToken
    await prisma.ga4Connection.update({
      where: { tenantId: conn.tenantId },
      data: { accessToken, expiresAt: refreshed.expiresAt },
    })
  }

  return { client: new Ga4HttpClient(accessToken), propertyId: conn.propertyId }
}
