import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import { listDailyMetrics, getMetricsSummary, syncGa4Data } from '@/modules/analytics'
import SyncGa4Button from './sync-ga4-button'

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">±0%</span>
  const sign = value > 0 ? '+' : ''
  const color = value > 0 ? 'text-green-500' : 'text-destructive'
  return <span className={`text-xs font-medium ${color}`}>{sign}{value}%</span>
}

export default async function AnalyticsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const connection = await prisma.ga4Connection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })

  // データが存在しない場合は同期
  const existing = await listDailyMetrics(ctx.tenant.id, 1)
  if (existing.length === 0) {
    await syncGa4Data(ctx.tenant.id)
  }

  const [metrics, summary] = await Promise.all([
    listDailyMetrics(ctx.tenant.id, 30),
    getMetricsSummary(ctx.tenant.id),
  ])

  const stats = [
    { label: 'セッション (30日)', value: summary.totalSessions.toLocaleString(), trend: summary.sessionsTrend },
    { label: 'ユーザー (30日)', value: summary.totalUsers.toLocaleString(), trend: null },
    { label: 'ページビュー (30日)', value: summary.totalPageviews.toLocaleString(), trend: null },
    { label: 'オーガニックセッション', value: summary.totalOrganicSessions.toLocaleString(), trend: null },
    { label: 'オーガニック流入率', value: `${summary.organicShare}%`, trend: null },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">アナリティクス</h1>
        <div className="flex items-center gap-3">
          {!connection?.propertyId && (
            <Link
              href="/dashboard/analytics/connect"
              className="text-sm text-muted-foreground underline"
            >
              GA4 プロパティを設定
            </Link>
          )}
          <SyncGa4Button />
        </div>
      </div>

      {!connection && (
        <div className="mb-6 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          GA4 が未接続のためモックデータを表示しています。
          <Link href="/dashboard/analytics/connect" className="ml-1 underline">
            GA4 設定
          </Link>
          から接続してください。
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
              {stat.trend !== null && (
                <div className="mt-1">
                  <TrendBadge value={stat.trend} />
                  <span className="ml-1 text-xs text-muted-foreground">先週比</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 日次テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">日次トレンド（直近 30 日）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">日付</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">セッション</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">ユーザー</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">PV</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">オーガニック</th>
                </tr>
              </thead>
              <tbody>
                {[...metrics].reverse().map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2 font-mono text-xs">
                      {m.date.toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-2 text-right">{m.sessions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{m.users.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{m.pageviews.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-green-600">{m.organicSessions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
