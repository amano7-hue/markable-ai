import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'アトリビューション' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAttributionFunnel, getSeoAttribution, getModuleActivity } from '@/modules/attribution'
import { prisma } from '@/lib/db/client'
import { CheckCircle2, Users, TrendingUp, Sparkles, ArrowUpRight, ArrowDownRight, AlertCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return <span className="text-xs text-muted-foreground">±0% 先週比</span>
  const isUp = pct > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? '+' : ''}{pct}% 先週比
    </span>
  )
}

function PositionBadge({ pos }: { pos: number | null }) {
  if (pos === null) return <span className="text-muted-foreground">-</span>
  if (pos <= 3) return <Badge className="bg-green-600 text-white hover:bg-green-600">{pos}</Badge>
  if (pos <= 10) return <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">{pos}</Badge>
  if (pos <= 30) return <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">{pos}</Badge>
  return <Badge variant="outline">{pos.toFixed(1)}</Badge>
}

export default async function AttributionPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const [funnel, seoRows, activity, weeklyMetrics, prevWeekMetrics, totalPending] = await Promise.all([
    getAttributionFunnel(ctx.tenant.id),
    getSeoAttribution(ctx.tenant.id),
    getModuleActivity(ctx.tenant.id),
    // 今週の成果データ
    Promise.all([
      prisma.approvalItem.count({
        where: { tenantId: ctx.tenant.id, status: 'APPROVED', reviewedAt: { gte: weekAgo } },
      }),
      prisma.nurtureLead.count({
        where: { tenantId: ctx.tenant.id, createdAt: { gte: weekAgo } },
      }),
      prisma.seoKeywordSnapshot.groupBy({
        by: ['keywordId'],
        where: { tenantId: ctx.tenant.id, position: { lte: 10 }, snapshotDate: { gte: weekAgo } },
      }).then((rows) => rows.length),
      prisma.ga4DailyMetric.aggregate({
        where: { tenantId: ctx.tenant.id, date: { gte: weekAgo } },
        _sum: { sessions: true, organicSessions: true },
      }),
    ]).then(([approvedContent, newLeads, top10Keywords, sessions]) => ({
      approvedContent,
      newLeads,
      top10Keywords,
      weekSessions: sessions._sum.sessions ?? 0,
      weekOrganicSessions: sessions._sum.organicSessions ?? 0,
    })),
    // 先週（7〜14日前）
    Promise.all([
      prisma.approvalItem.count({
        where: { tenantId: ctx.tenant.id, status: 'APPROVED', reviewedAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      prisma.nurtureLead.count({
        where: { tenantId: ctx.tenant.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      prisma.ga4DailyMetric.aggregate({
        where: { tenantId: ctx.tenant.id, date: { gte: twoWeeksAgo, lt: weekAgo } },
        _sum: { organicSessions: true },
      }),
    ]).then(([prevApproved, prevLeads, prevSessions]) => ({
      approvedContent: prevApproved,
      newLeads: prevLeads,
      weekOrganicSessions: prevSessions._sum.organicSessions ?? 0,
    })),
    prisma.approvalItem.count({ where: { tenantId: ctx.tenant.id, status: 'PENDING' } }),
  ])

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">アトリビューション</h1>
        {totalPending > 0 && (
          <Link
            href="/dashboard/approval"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2 text-sm text-amber-800 hover:bg-amber-100 transition-colors dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300"
          >
            <AlertCircle className="h-4 w-4" />
            <span>承認待ち <strong>{totalPending} 件</strong></span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* 今週の成果サマリー */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">今週の成果</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'AI コンテンツ公開',
              value: weeklyMetrics.approvedContent,
              rawValue: weeklyMetrics.approvedContent,
              prevValue: prevWeekMetrics.approvedContent,
              sub: '件 承認・適用済み',
              Icon: Sparkles,
              good: weeklyMetrics.approvedContent > 0,
            },
            {
              label: '新規リード獲得',
              value: weeklyMetrics.newLeads,
              rawValue: weeklyMetrics.newLeads,
              prevValue: prevWeekMetrics.newLeads,
              sub: '件 追加',
              Icon: Users,
              good: weeklyMetrics.newLeads > 0,
            },
            {
              label: 'TOP10 キーワード',
              value: weeklyMetrics.top10Keywords,
              rawValue: weeklyMetrics.top10Keywords,
              prevValue: null,
              sub: '件 TOP10 圏内',
              Icon: TrendingUp,
              good: weeklyMetrics.top10Keywords > 0,
            },
            {
              label: 'オーガニックセッション',
              value: weeklyMetrics.weekOrganicSessions.toLocaleString(),
              rawValue: weeklyMetrics.weekOrganicSessions,
              prevValue: prevWeekMetrics.weekOrganicSessions,
              sub: `総 ${weeklyMetrics.weekSessions.toLocaleString()} セッション`,
              Icon: CheckCircle2,
              good: weeklyMetrics.weekOrganicSessions > 0,
            },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="pt-4 pb-3">
                <item.Icon className={cn('mb-2 h-4 w-4', item.good ? 'text-primary' : 'text-muted-foreground')} />
                <p className={cn('text-2xl font-bold tabular-nums', item.good ? '' : 'text-muted-foreground')}>
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
                {item.prevValue !== null && (
                  <div className="mt-1">
                    <DeltaBadge current={item.rawValue} previous={item.prevValue} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* マーケティングファネル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">マーケティングファネル ({funnel.period})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1" style={{ height: 160 }}>
            {funnel.steps.map((step, i) => {
              const maxVal = funnel.steps[0].value || 1
              const heightPct = Math.max((step.value / maxVal) * 100, 4)
              const colors = [
                'bg-blue-500/80',
                'bg-violet-500/80',
                'bg-emerald-500/80',
                'bg-amber-500/80',
                'bg-rose-500/80',
              ]
              return (
                <div key={step.label} className="flex flex-1 flex-col items-center gap-1.5">
                  {step.rate !== null ? (
                    <span className="text-xs text-muted-foreground">↓ {step.rate}%</span>
                  ) : i > 0 ? (
                    <span className="invisible text-xs">↓</span>
                  ) : null}
                  <div className="flex w-full flex-1 flex-col justify-end">
                    <div
                      className={`w-full rounded-t-md ${colors[i % colors.length]}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <p className="text-sm font-bold tabular-nums">{step.value.toLocaleString()}</p>
                  <p className="text-center text-xs leading-tight text-muted-foreground">
                    {step.label}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* SEO キーワード × クリック */}
      {seoRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SEO キーワード パフォーマンス（直近 30 日）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">キーワード</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">順位</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">クリック</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">表示</th>
                </tr>
              </thead>
              <tbody>
                {seoRows.map((row) => (
                  <tr key={row.keyword} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2 font-medium">{row.keyword}</td>
                    <td className="px-4 py-2 text-right">
                      <PositionBadge pos={row.latestPosition} />
                    </td>
                    <td className="px-4 py-2 text-right">{row.clicks30d.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{row.impressions30d.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* モジュール活動サマリー */}
      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">モジュール活動サマリー</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">モジュール</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">総生成</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">承認済み</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">承認待ち</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">承認率</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((mod) => {
                  const approvalRate = mod.total > 0
                    ? Math.round((mod.approved / mod.total) * 100)
                    : 0
                  const moduleHref = `/dashboard/approval?module=${mod.module}`
                  const pendingHref = `/dashboard/approval?module=${mod.module}&status=PENDING`
                  return (
                    <tr key={mod.module} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-2 font-medium">
                        <Link href={moduleHref} className="hover:text-primary hover:underline underline-offset-2 transition-colors">
                          {mod.label}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right">{mod.total}</td>
                      <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{mod.approved}</td>
                      <td className="px-4 py-2 text-right">
                        {mod.pending > 0 ? (
                          <Link href={pendingHref}>
                            <Badge variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 transition-colors">
                              {mod.pending}
                            </Badge>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className={cn(
                        'px-4 py-2 text-right font-medium',
                        approvalRate >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                          : approvalRate >= 40 ? 'text-amber-600 dark:text-amber-400'
                          : mod.total > 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}>{mod.total > 0 ? `${approvalRate}%` : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
