import { prisma } from '@/lib/db/client'
import { getGa4Client } from '@/integrations/ga4'

const UPSERT_BATCH = 10

export async function syncGa4Data(tenantId: string, days = 30): Promise<number> {
  const conn = await prisma.ga4Connection.findUnique({ where: { tenantId } })
  const { client, propertyId } = await getGa4Client(conn)

  const rows = await client.getDailyMetrics(propertyId, days)

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)
    await Promise.all(
      batch.map((row) => {
        const year = parseInt(row.date.slice(0, 4), 10)
        const month = parseInt(row.date.slice(4, 6), 10) - 1
        const day = parseInt(row.date.slice(6, 8), 10)
        const date = new Date(Date.UTC(year, month, day))
        const metrics = {
          sessions: row.sessions,
          users: row.users,
          newUsers: row.newUsers,
          pageviews: row.pageviews,
          organicSessions: row.organicSessions,
        }
        return prisma.ga4DailyMetric.upsert({
          where: { tenantId_date: { tenantId, date } },
          create: { tenantId, date, ...metrics },
          update: metrics,
        })
      }),
    )
  }

  return rows.length
}

export async function listDailyMetrics(tenantId: string, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  return prisma.ga4DailyMetric.findMany({
    where: { tenantId, date: { gte: since } },
    orderBy: { date: 'asc' },
  })
}

export interface MetricsSummary {
  totalSessions: number
  totalUsers: number
  totalPageviews: number
  totalOrganicSessions: number
  organicShare: number // %
  sessionsTrend: number // this week vs last week %
}

export async function getMetricsSummary(tenantId: string): Promise<MetricsSummary> {
  const now = new Date()

  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - 7)

  const lastWeekStart = new Date(now)
  lastWeekStart.setDate(now.getDate() - 14)

  const [last30, thisWeek, lastWeek] = await Promise.all([
    prisma.ga4DailyMetric.aggregate({
      where: {
        tenantId,
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _sum: { sessions: true, users: true, pageviews: true, organicSessions: true },
    }),
    prisma.ga4DailyMetric.aggregate({
      where: { tenantId, date: { gte: thisWeekStart } },
      _sum: { sessions: true },
    }),
    prisma.ga4DailyMetric.aggregate({
      where: { tenantId, date: { gte: lastWeekStart, lt: thisWeekStart } },
      _sum: { sessions: true },
    }),
  ])

  const totalSessions = last30._sum.sessions ?? 0
  const totalOrganicSessions = last30._sum.organicSessions ?? 0
  const thisWeekSessions = thisWeek._sum.sessions ?? 0
  const lastWeekSessions = lastWeek._sum.sessions ?? 0

  const organicShare =
    totalSessions > 0 ? Math.round((totalOrganicSessions / totalSessions) * 100) : 0

  const sessionsTrend =
    lastWeekSessions > 0
      ? Math.round(((thisWeekSessions - lastWeekSessions) / lastWeekSessions) * 100)
      : 0

  return {
    totalSessions,
    totalUsers: last30._sum.users ?? 0,
    totalPageviews: last30._sum.pageviews ?? 0,
    totalOrganicSessions,
    organicShare,
    sessionsTrend,
  }
}
