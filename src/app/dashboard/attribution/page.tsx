import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'アトリビューション' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAttributionFunnel, getSeoAttribution, getModuleActivity } from '@/modules/attribution'
import { prisma } from '@/lib/db/client'
import { CheckCircle2, Users, TrendingUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  const [funnel, seoRows, activity, weeklyMetrics] = await Promise.all([
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
  ])

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold">アトリビューション</h1>

      {/* 今週の成果サマリー */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">今週の成果</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'AI コンテンツ公開',
              value: weeklyMetrics.approvedContent,
              sub: '件 承認・適用済み',
              Icon: Sparkles,
              good: weeklyMetrics.approvedContent > 0,
            },
            {
              label: '新規リード獲得',
              value: weeklyMetrics.newLeads,
              sub: '件 追加',
              Icon: Users,
              good: weeklyMetrics.newLeads > 0,
            },
            {
              label: 'TOP10 キーワード',
              value: weeklyMetrics.top10Keywords,
              sub: '件 TOP10 圏内',
              Icon: TrendingUp,
              good: weeklyMetrics.top10Keywords > 0,
            },
            {
              label: 'オーガニックセッション',
              value: weeklyMetrics.weekOrganicSessions.toLocaleString(),
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
                  return (
                    <tr key={mod.module} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-2 font-medium">{mod.label}</td>
                      <td className="px-4 py-2 text-right">{mod.total}</td>
                      <td className="px-4 py-2 text-right text-green-600">{mod.approved}</td>
                      <td className="px-4 py-2 text-right">
                        {mod.pending > 0 ? (
                          <Badge variant="outline">{mod.pending}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">{approvalRate}%</td>
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
