import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/empty-state'
import { Clock, Calendar, TrendingUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: '配信タイミング最適化 — ナーチャリング' }

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const DOW_LABELS_LONG = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']

export default async function TimingPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const tenantId = ctx.tenant.id

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // GA4 の過去 30 日分のデイリーメトリクス
  const ga4Metrics = await prisma.ga4DailyMetric.findMany({
    where: { tenantId, date: { gte: thirtyDaysAgo } },
    orderBy: { date: 'asc' },
    select: { date: true, organicSessions: true, sessions: true },
  })

  // リード作成日・開封データの過去 90 日分
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const leads = await prisma.nurtureLead.findMany({
    where: { tenantId, createdAt: { gte: ninetyDaysAgo } },
    select: { createdAt: true, lastEmailOpenAt: true, emailOpenCount: true, emailClickCount: true },
  })

  // 承認済みメールの曜日分析（実際の配信記録の代替として使用）
  const approvedEmails = await prisma.nurtureEmailDraft.findMany({
    where: { tenantId, status: 'APPROVED' },
    select: { reviewedAt: true },
  })

  // 曜日別集計 (0=日, 1=月, ..., 6=土)
  const ga4ByDow = Array(7).fill(0) as number[]
  const ga4CountByDow = Array(7).fill(0) as number[]
  for (const m of ga4Metrics) {
    const dow = m.date.getDay()
    ga4ByDow[dow] += m.organicSessions
    ga4CountByDow[dow]++
  }
  // 平均オーガニックセッション/曜日
  const ga4AvgByDow = ga4ByDow.map((sum, i) =>
    ga4CountByDow[i] > 0 ? Math.round(sum / ga4CountByDow[i]) : 0,
  )

  const leadsByDow = Array(7).fill(0) as number[]
  for (const lead of leads) {
    leadsByDow[lead.createdAt.getDay()]++
  }

  // メール開封日の曜日集計（lastEmailOpenAt から）
  const opensByDow = Array(7).fill(0) as number[]
  for (const lead of leads) {
    if (lead.lastEmailOpenAt) {
      opensByDow[lead.lastEmailOpenAt.getDay()]++
    }
  }
  const totalOpens = leads.reduce((sum, l) => sum + (l.emailOpenCount ?? 0), 0)
  const totalClicks = leads.reduce((sum, l) => sum + (l.emailClickCount ?? 0), 0)
  const hasEngagementData = totalOpens > 0

  const emailsByDow = Array(7).fill(0) as number[]
  for (const email of approvedEmails) {
    if (email.reviewedAt) emailsByDow[email.reviewedAt.getDay()]++
  }

  // 総合スコア: GA4オーガニックセッション(0.4) + リード生成(0.3) + メール開封(0.3)
  const maxGa4 = Math.max(...ga4AvgByDow, 1)
  const maxLeads = Math.max(...leadsByDow, 1)
  const maxOpens = Math.max(...opensByDow, 1)
  const compositeScore = ga4AvgByDow.map((g, i) => {
    const ga4Norm = g / maxGa4
    const leadNorm = leadsByDow[i] / maxLeads
    const openNorm = hasEngagementData ? opensByDow[i] / maxOpens : 0
    const openWeight = hasEngagementData ? 0.3 : 0
    const ga4Weight = hasEngagementData ? 0.4 : 0.5
    const leadWeight = hasEngagementData ? 0.3 : 0.5
    return Math.round((ga4Norm * ga4Weight + leadNorm * leadWeight + openNorm * openWeight) * 100)
  })

  // 推奨曜日 Top 3（土日は除外 or 加味）
  const ranked = compositeScore
    .map((score, dow) => ({ dow, score }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)

  const top3 = ranked.slice(0, 3)
  const bestDow = top3[0]?.dow ?? null
  const hasData = ga4Metrics.length > 0 || leads.length > 0

  // バー最大値
  const maxScore = Math.max(...compositeScore, 1)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">配信タイミング最適化</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            GA4 オーガニックセッション・リード生成・メール開封データから最適な配信曜日を算出
          </p>
        </div>
        {bestDow !== null && (
          <Badge className="bg-primary text-primary-foreground text-sm">
            推奨: {DOW_LABELS_LONG[bestDow]}
          </Badge>
        )}
      </div>

      {!hasData ? (
        <EmptyState
          icon={Clock}
          title="データが不足しています"
          description="GA4 を接続するか HubSpot からリードを同期すると配信タイミング分析が利用できます。"
        />
      ) : (
        <div className="space-y-6">
          {/* 推奨曜日カード */}
          {top3.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {top3.map((item, rank) => (
                <Card
                  key={item.dow}
                  className={rank === 0 ? 'border-primary/40 bg-primary/5' : ''}
                >
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        {rank === 0 && (
                          <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary uppercase tracking-wide">
                            <Sparkles className="h-3 w-3" />
                            最も推奨
                          </div>
                        )}
                        <p className="text-2xl font-bold">{DOW_LABELS_LONG[item.dow]}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {rank === 0 ? '第1推奨' : rank === 1 ? '第2推奨' : '第3推奨'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">スコア</p>
                        <p
                          className={cn(
                            'text-xl font-bold tabular-nums',
                            rank === 0 ? 'text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {item.score}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {ga4AvgByDow[item.dow] > 0 && (
                        <p>平均オーガニック: {ga4AvgByDow[item.dow].toLocaleString()} セッション</p>
                      )}
                      {leadsByDow[item.dow] > 0 && (
                        <p>90 日間リード: {leadsByDow[item.dow]} 件</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 曜日別ヒートバー */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                曜日別スコア
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {hasEngagementData
                  ? 'スコア = オーガニックセッション (40%) + リード生成数 (30%) + メール開封 (30%) の正規化合計'
                  : 'スコア = オーガニックセッション (50%) + リード生成数 (50%) の正規化合計'}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DOW_LABELS.map((label, dow) => {
                  const score = compositeScore[dow]
                  const widthPct = (score / maxScore) * 100
                  const isTop = top3[0]?.dow === dow
                  const isRecommended = top3.some((t) => t.dow === dow)
                  return (
                    <div key={dow} className="flex items-center gap-3">
                      <span
                        className={cn(
                          'w-5 shrink-0 text-center text-sm font-medium',
                          isTop ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {label}
                      </span>
                      <div className="flex-1">
                        <div className="relative h-7 overflow-hidden rounded-md bg-muted">
                          {score > 0 && (
                            <div
                              className={cn(
                                'h-full rounded-md transition-all',
                                isTop
                                  ? 'bg-primary'
                                  : isRecommended
                                  ? 'bg-primary/60'
                                  : 'bg-muted-foreground/20',
                              )}
                              style={{ width: `${widthPct}%` }}
                            />
                          )}
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                            {score > 0 ? `スコア ${score}` : 'データなし'}
                          </span>
                        </div>
                      </div>
                      <div className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                        {ga4AvgByDow[dow] > 0 && `${ga4AvgByDow[dow]} セッション`}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 詳細データ */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* GA4 オーガニックセッション */}
            {ga4Metrics.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4" />
                    GA4 オーガニックセッション（曜日平均）
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">過去 30 日間</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {DOW_LABELS.map((label, dow) => {
                      const avg = ga4AvgByDow[dow]
                      const maxAvg = Math.max(...ga4AvgByDow, 1)
                      return (
                        <div key={dow} className="flex items-center gap-2">
                          <span className="w-4 shrink-0 text-xs text-muted-foreground">{label}</span>
                          <div className="flex-1 h-4 overflow-hidden rounded bg-muted">
                            {avg > 0 && (
                              <div
                                className="h-full rounded bg-blue-400/70"
                                style={{ width: `${(avg / maxAvg) * 100}%` }}
                              />
                            )}
                          </div>
                          <span className="w-12 shrink-0 text-right text-xs tabular-nums">
                            {avg.toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* リード生成 */}
            {leads.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    リード生成数（曜日別）
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">過去 90 日間</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {DOW_LABELS.map((label, dow) => {
                      const count = leadsByDow[dow]
                      const maxCount = Math.max(...leadsByDow, 1)
                      return (
                        <div key={dow} className="flex items-center gap-2">
                          <span className="w-4 shrink-0 text-xs text-muted-foreground">{label}</span>
                          <div className="flex-1 h-4 overflow-hidden rounded bg-muted">
                            {count > 0 && (
                              <div
                                className="h-full rounded bg-emerald-400/70"
                                style={{ width: `${(count / maxCount) * 100}%` }}
                              />
                            )}
                          </div>
                          <span className="w-8 shrink-0 text-right text-xs tabular-nums">
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* メール開封分析 */}
          {hasEngagementData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  メール開封傾向（曜日別）
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  HubSpot 開封データより — 累計開封 {totalOpens.toLocaleString()} 回 / クリック {totalClicks.toLocaleString()} 回
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {DOW_LABELS.map((label, dow) => {
                    const count = opensByDow[dow]
                    const maxCount = Math.max(...opensByDow, 1)
                    return (
                      <div key={dow} className="flex items-center gap-2">
                        <span className="w-4 shrink-0 text-xs text-muted-foreground">{label}</span>
                        <div className="flex-1 h-4 overflow-hidden rounded bg-muted">
                          {count > 0 && (
                            <div
                              className="h-full rounded bg-amber-400/70"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          )}
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs tabular-nums">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* アドバイス */}
          <Card className="border-border bg-muted/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-sm font-medium mb-2">配信タイミングのポイント</p>
              <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                <li>メール開封率はオーガニック検索が活発な曜日に高い傾向があります</li>
                <li>BtoB の場合、月〜木（特に火・水）は意思決定者のオンライン率が高いです</li>
                <li>金曜午後〜日曜はメール確認が遅れやすいため、緊急でない場合は避けましょう</li>
                {bestDow !== null && (
                  <li>
                    このテナントの最推奨日は{' '}
                    <strong className="text-foreground">{DOW_LABELS_LONG[bestDow]}</strong> です
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
