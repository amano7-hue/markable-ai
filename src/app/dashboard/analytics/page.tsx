import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { prisma } from '@/lib/db/client'
import { listDailyMetrics, getMetricsSummary, syncGa4Data } from '@/modules/analytics'
import SyncGa4Button from './sync-ga4-button'
import Sparkline from '@/components/sparkline'
import { Users, Eye, MousePointer, TrendingUp, Leaf, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'アナリティクス' }

type Props = { params?: Promise<{ projectId?: string }> }

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

export default async function AnalyticsPage({ params }: Props) {
  const { projectId } = (await params) ?? {}
  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')

  const basePath = projectId ? `/dashboard/p/${projectId}` : '/dashboard'
  const pf = projectId ? { projectId } : {}

  // プロジェクト別 GA4 接続を確認
  const connection = await prisma.ga4Connection.findFirst({
    where: { tenantId: ctx.tenant.id, ...pf },
  })

  // データがなければ同期を試みる（接続がある場合のみ）
  if (connection && projectId) {
    const dataCount = await prisma.ga4DailyMetric.count({
      where: { tenantId: ctx.tenant.id, ...pf },
    })
    if (dataCount === 0) {
      await syncGa4Data(ctx.tenant.id, projectId)
    }
  }

  const now = new Date()
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - 7)
  const lastWeekStart = new Date(now)
  lastWeekStart.setDate(now.getDate() - 14)

  const [metrics, summary, thisWeekMetrics, lastWeekMetrics] = await Promise.all([
    listDailyMetrics(ctx.tenant.id, 30, projectId),
    getMetricsSummary(ctx.tenant.id, projectId),
    prisma.ga4DailyMetric.aggregate({
      where: { tenantId: ctx.tenant.id, ...pf, date: { gte: thisWeekStart } },
      _sum: { sessions: true, users: true, pageviews: true, organicSessions: true },
    }),
    prisma.ga4DailyMetric.aggregate({
      where: { tenantId: ctx.tenant.id, ...pf, date: { gte: lastWeekStart, lt: thisWeekStart } },
      _sum: { sessions: true, users: true, pageviews: true, organicSessions: true },
    }),
  ])

  function weekTrend(current: number, previous: number) {
    if (previous === 0) return null
    return Math.round(((current - previous) / previous) * 100)
  }

  const tw = thisWeekMetrics._sum
  const lw = lastWeekMetrics._sum
  const organicTrend = weekTrend(tw.organicSessions ?? 0, lw.organicSessions ?? 0) ?? 0
  const sessionsTrendWeek = weekTrend(tw.sessions ?? 0, lw.sessions ?? 0)
  const usersTrend = weekTrend(tw.users ?? 0, lw.users ?? 0)
  const pageviewsTrend = weekTrend(tw.pageviews ?? 0, lw.pageviews ?? 0)

  const connectHref = `${basePath}/analytics/connect`
  const seoHref = `${basePath}/seo/opportunities`
  const llmoHref = `${basePath}/llmo/prompts`

  const stats = [
    {
      label: 'セッション (30日)',
      value: summary.totalSessions.toLocaleString(),
      trend: sessionsTrendWeek ?? summary.sessionsTrend,
      Icon: MousePointer,
      iconBg: 'bg-blue-50 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'ユーザー (30日)',
      value: summary.totalUsers.toLocaleString(),
      trend: usersTrend,
      Icon: Users,
      iconBg: 'bg-violet-50 dark:bg-violet-950',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: 'ページビュー (30日)',
      value: summary.totalPageviews.toLocaleString(),
      trend: pageviewsTrend,
      Icon: Eye,
      iconBg: 'bg-amber-50 dark:bg-amber-950',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'オーガニックセッション',
      value: summary.totalOrganicSessions.toLocaleString(),
      trend: organicTrend,
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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">アナリティクス</h1>
          {metrics.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              データ最終日: {metrics[metrics.length - 1].date.toLocaleDateString('ja-JP')} (自動)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!connection?.propertyId && (
            <Link href={connectHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              GA4 を接続
            </Link>
          )}
          <SyncGa4Button projectId={projectId} />
        </div>
      </div>

      {!connection && (
        <div className="mb-6 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          GA4 が未接続のためデータがありません。
          <Link href={connectHref} className="ml-1 font-medium underline underline-offset-2">
            GA4 設定
          </Link>
          から接続してください。
        </div>
      )}

      {connection && summary.organicShare < 20 && summary.totalSessions > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          <div>
            <p className="font-medium">オーガニック率が {summary.organicShare}% と低い状態です</p>
            <p className="mt-0.5 text-xs opacity-80">
              SEO キーワードの強化・LLMO の引用率向上でオーガニック流入を改善できます
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:ml-4 sm:shrink-0">
            <Link href={seoHref} className="rounded border border-amber-400/50 bg-amber-100 px-3 py-1.5 text-xs font-medium hover:bg-amber-200 transition-colors dark:border-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/60">
              SEO 改善機会
            </Link>
            <Link href={llmoHref} className="rounded border border-amber-400/50 bg-amber-100 px-3 py-1.5 text-xs font-medium hover:bg-amber-200 transition-colors dark:border-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/60">
              LLMO プロンプト
            </Link>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">オーガニック率 トレンド（30日）</CardTitle>
            </CardHeader>
            <CardContent>
              <Sparkline
                data={metrics.map((m) => ({
                  label: m.date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                  value: m.sessions > 0 ? Math.round((m.organicSessions / m.sessions) * 100) : 0,
                }))}
                height={80}
                color="hsl(217 91% 60%)"
              />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                現在 {summary.organicShare}%
                {summary.organicShare >= 40
                  ? ' — 良好'
                  : summary.organicShare >= 20
                  ? ' — 改善余地あり'
                  : ' — 要改善'}
              </p>
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
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">日付</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">セッション</th>
                  <th className="hidden px-3 py-2.5 text-right text-xs font-medium text-muted-foreground sm:table-cell">ユーザー</th>
                  <th className="hidden px-3 py-2.5 text-right text-xs font-medium text-muted-foreground sm:table-cell">PV</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">オーガニック</th>
                </tr>
              </thead>
              <tbody>
                {[...metrics].reverse().map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      {m.date.toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{m.sessions.toLocaleString()}</td>
                    <td className="hidden px-3 py-2 text-right text-xs tabular-nums sm:table-cell">{m.users.toLocaleString()}</td>
                    <td className="hidden px-3 py-2 text-right text-xs tabular-nums sm:table-cell">{m.pageviews.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-600 dark:text-emerald-400">{m.organicSessions.toLocaleString()}</td>
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
