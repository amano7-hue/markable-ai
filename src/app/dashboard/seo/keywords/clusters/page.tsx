import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/empty-state'
import { Layers, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export const metadata: Metadata = { title: 'クラスター — SEO キーワード' }

const INTENT_LABELS: Record<string, string> = {
  informational: '情報収集',
  commercial: '比較検討',
  navigational: 'ナビゲーション',
}

const INTENT_COLORS: Record<string, string> = {
  informational: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300/50',
  commercial: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300/50',
  navigational: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-300/50',
}

function PositionIndicator({ avg }: { avg: number | null }) {
  if (avg === null) return <span className="text-muted-foreground">—</span>
  const color =
    avg <= 3
      ? 'text-emerald-600 dark:text-emerald-400'
      : avg <= 10
      ? 'text-blue-600 dark:text-blue-400'
      : avg <= 30
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-destructive'
  return <span className={`font-medium ${color}`}>{avg.toFixed(1)}</span>
}

export default async function KeywordClustersPage({ params }: { params?: Promise<{ projectId?: string }> }) {
  const { projectId } = (await params) ?? {}
  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')

  const tenantId = ctx.tenant.id
  const pf = projectId ? { projectId } : {}

  // intent ごとのキーワード数
  const intentCounts = await prisma.seoKeyword.groupBy({
    by: ['intent'],
    where: { tenantId, isActive: true, ...pf },
    _count: true,
  })

  // 最新スナップショット日
  const latestSnap = await prisma.seoKeywordSnapshot.findFirst({
    where: { tenantId, ...pf },
    orderBy: { snapshotDate: 'desc' },
    select: { snapshotDate: true },
  })

  // intent ごとの最新スナップショット集計
  type ClusterStat = {
    intent: string | null
    count: number
    avgPosition: number | null
    avgCtr: number | null
    totalImpressions: number
    totalClicks: number
    top10Count: number
  }

  let clusterStats: ClusterStat[] = []

  if (latestSnap) {
    const snaps = await prisma.seoKeywordSnapshot.findMany({
      where: { tenantId, snapshotDate: latestSnap.snapshotDate, ...pf },
      include: { keyword: { select: { intent: true, isActive: true } } },
    })

    // intent ごとに集計
    const groups = new Map<string | null, typeof snaps>()
    for (const s of snaps) {
      if (!s.keyword.isActive) continue
      const key = s.keyword.intent
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }

    clusterStats = Array.from(groups.entries()).map(([intent, items]) => {
      const withPos = items.filter((s) => s.position > 0)
      const avgPosition =
        withPos.length > 0
          ? withPos.reduce((sum, s) => sum + s.position, 0) / withPos.length
          : null
      const avgCtr =
        items.length > 0
          ? items.reduce((sum, s) => sum + s.ctr, 0) / items.length
          : null
      const totalImpressions = items.reduce((sum, s) => sum + s.impressions, 0)
      const totalClicks = items.reduce((sum, s) => sum + s.clicks, 0)
      const top10Count = items.filter((s) => s.position > 0 && s.position <= 10).length

      return {
        intent,
        count: items.length,
        avgPosition,
        avgCtr,
        totalImpressions,
        totalClicks,
        top10Count,
      }
    })
  } else {
    // スナップなし: intent ごとのカウントのみ
    clusterStats = intentCounts.map((c) => ({
      intent: c.intent,
      count: c._count,
      avgPosition: null,
      avgCtr: null,
      totalImpressions: 0,
      totalClicks: 0,
      top10Count: 0,
    }))
  }

  // 並び順: 順位が良い順 → null last
  clusterStats.sort((a, b) => {
    if (a.avgPosition === null && b.avgPosition === null) return 0
    if (a.avgPosition === null) return 1
    if (b.avgPosition === null) return -1
    return a.avgPosition - b.avgPosition
  })

  const totalKeywords = intentCounts.reduce((s, c) => s + c._count, 0)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">キーワードクラスター</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            検索意図 (intent) 別に集計したキーワード群
          </p>
        </div>
        <Link
          href="/dashboard/seo/keywords"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← キーワード一覧
        </Link>
      </div>

      {/* タブ */}
      <div className="mb-6 flex gap-1 border-b border-border text-sm">
        <Link
          href="/dashboard/seo/keywords"
          className="border-b-2 border-transparent px-3 pb-2 text-muted-foreground hover:text-foreground"
        >
          一覧
        </Link>
        <span className="border-b-2 border-primary px-3 pb-2 font-medium text-foreground">
          クラスター
        </span>
      </div>

      {totalKeywords === 0 ? (
        <EmptyState
          icon={Layers}
          title="キーワードがありません"
          description="キーワードを追加してから intent を設定するとクラスター表示が利用できます。"
          action={
            <Link
              href="/dashboard/seo/keywords/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              + キーワード追加
            </Link>
          }
        />
      ) : (
        <>
          {latestSnap && (
            <p className="mb-4 text-xs text-muted-foreground">
              データ: {latestSnap.snapshotDate.toLocaleDateString('ja-JP')}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clusterStats.map((cluster) => {
              const intentKey = cluster.intent ?? ''
              const label = INTENT_LABELS[intentKey] ?? (intentKey || '未分類')
              const colorClass =
                INTENT_COLORS[intentKey] ??
                'bg-muted/60 text-muted-foreground border-border'

              return (
                <Card
                  key={intentKey}
                  className={`border ${colorClass.includes('bg-') ? '' : ''}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm font-semibold">
                      <span>{label}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${colorClass}`}
                      >
                        {cluster.count} 件
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">平均順位</p>
                        <PositionIndicator avg={cluster.avgPosition} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">平均CTR</p>
                        <span className="font-medium">
                          {cluster.avgCtr !== null
                            ? `${(cluster.avgCtr * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">表示回数合計</p>
                        <span className="font-medium">
                          {cluster.totalImpressions.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">TOP10</p>
                        <span className="font-medium">
                          {cluster.totalImpressions > 0
                            ? `${cluster.top10Count} / ${cluster.count}`
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* TOP10 割合バー */}
                    {cluster.count > 0 && cluster.totalImpressions > 0 && (
                      <div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${(cluster.top10Count / cluster.count) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          TOP10 率 {((cluster.top10Count / cluster.count) * 100).toFixed(0)}%
                        </p>
                      </div>
                    )}

                    <Link
                      href={`/dashboard/seo/keywords${intentKey ? `?intent=${intentKey}` : ''}`}
                      className="block text-xs text-primary hover:underline"
                    >
                      キーワード一覧で絞り込む →
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
