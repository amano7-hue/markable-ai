import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { prisma } from '@/lib/db/client'
import { listDailyMetrics, getMetricsSummary, syncGa4Data } from '@/modules/analytics'
import SyncGa4Button from './sync-ga4-button'
import Sparkline from '@/components/sparkline'
import { Users, Eye, MousePointer, TrendingUp, Leaf, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'アナリティクス' }

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">±0%</span>
  const isUp = value > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', isUp ? 'text-emerald-600' : 'text-destructive')}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? '+' : ''}{value}%
    </span>
  )
}

export default async function AnalyticsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const connection = await prisma.ga4Connection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })

  const dataCount = await prisma.ga4DailyMetric.count({ where: { tenantId: ctx.tenant.id } })
  if (dataCount === 0) {
    await syncGa4Data(ctx.tenant.id)
  }

  const [metrics, summary] = await Promise.all([
    listDailyMetrics(ctx.tenant.id, 30),
    getMetricsSummary(ctx.tenant.id),
  ])

  const stats = [
    {
      label: 'セッション (30日)',
      value: summary.totalSessions.toLocaleString(),
      trend: summary.sessionsTrend,
      Icon: MousePointer,
      iconBg: 'bg-blue-50 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'ユーザー (30日)',
      value: summary.totalUsers.toLocaleString(),
      trend: null,
      Icon: Users,
      iconBg: 'bg-violet-50 dark:bg-violet-950',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: 'ページビュー (30日)',
      value: summary.totalPageviews.toLocaleString(),
      trend: null,
      Icon: Eye,
      iconBg: 'bg-amber-50 dark:bg-amber-950',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'オーガニックセッション',
      value: summary.totalOrganicSessions.toLocaleString(),
      trend: null,
      Icon: Leaf,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'オーガニック率',
      value: `${summary.organicShare}%`,
      trend: null,
      Icon: TrendingUp,
      iconBg: summary.organicShare >= 40
        ? 'bg-emerald-50 dark:bg-emerald-950'
        : 'bg-amber-50 dark:bg-amber-950',
      iconColor: summary.organicShare >= 40
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">アナリティクス</h1>
        <div className="flex items-center gap-2">
          {!connection?.propertyId && (
            <Link href="/dashboard/analytics/connect" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              GA4 を接続
            </Link>
          )}
          <SyncGa4Button />
        </div>
      </div>

      {!connection && (
        <div className="mb-6 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          GA4 が未接続のためモックデータを表示しています。
          <Link href="/dashboard/analytics/connect" className="ml-1 font-medium underline underline-offset-2">
            GA4 設定
          </Link>
          から接続してください。
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <div className={cn('mb-3 inline-flex rounded-lg p-2', stat.iconBg)}>
                <stat.Icon className={cn('h-4 w-4', stat.iconColor)} />
              </div>
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              {stat.trend !== null && (
                <div className="mt-1 flex items-center gap-1">
                  <TrendBadge value={stat.trend} />
                  <span className="text-xs text-muted-foreground">先週比</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {metrics.length >= 2 && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">セッション トレンド（30日）</CardTitle>
            </CardHeader>
            <CardContent>
              <Sparkline
                data={metrics.map((m) => ({
                  label: m.date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                  value: m.sessions,
                }))}
                height={80}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">オーガニック セッション トレンド（30日）</CardTitle>
            </CardHeader>
            <CardContent>
              <Sparkline
                data={metrics.map((m) => ({
                  label: m.date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                  value: m.organicSessions,
                }))}
                height={80}
                color="hsl(142 76% 36%)"
              />
            </CardContent>
          </Card>
        </div>
      )}

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
                    <td className="px-4 py-2 text-right tabular-nums">{m.sessions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.users.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.pageviews.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.organicSessions.toLocaleString()}</td>
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
