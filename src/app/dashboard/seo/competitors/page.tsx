import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import EmptyState from '@/components/empty-state'
import { Search, AlertCircle, FileText, TrendingUp } from 'lucide-react'
import GenerateArticleButton from '@/app/dashboard/seo/keywords/[keywordId]/generate-article-button'

export const metadata: Metadata = { title: '競合コンテンツ差分分析 — SEO' }

const INTENT_LABELS: Record<string, string> = {
  informational: '情報収集',
  commercial: '比較検討',
  navigational: 'ナビゲーション',
}

const INTENT_COLORS: Record<string, string> = {
  informational: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300/50',
  commercial: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300/50',
  navigational: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300/50',
}

export default async function CompetitorsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const tenantId = ctx.tenant.id

  // 最新スナップショット日
  const latestSnap = await prisma.seoKeywordSnapshot.findFirst({
    where: { tenantId },
    orderBy: { snapshotDate: 'desc' },
    select: { snapshotDate: true },
  })

  if (!latestSnap) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">競合コンテンツ差分分析</h1>
        <EmptyState
          icon={Search}
          title="GSC データがありません"
          description="キーワードを同期してから分析を実行してください。"
        />
      </div>
    )
  }

  // 最新スナップショット全件（キーワード・記事情報込み）
  const snaps = await prisma.seoKeywordSnapshot.findMany({
    where: { tenantId, snapshotDate: latestSnap.snapshotDate },
    include: {
      keyword: {
        select: {
          id: true,
          text: true,
          intent: true,
          isActive: true,
          articles: {
            select: { id: true, title: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  type GapItem = {
    keywordId: string
    keywordText: string
    intent: string | null
    position: number
    impressions: number
    clicks: number
    ctr: number
    hasArticle: boolean
    articleTitle: string | null
    articleStatus: string | null
    gapType: 'no_content' | 'weak_content'
    priority: number
  }

  // コンテンツギャップ分析
  const gaps: GapItem[] = snaps
    .filter((s) => s.keyword.isActive && s.position > 10)
    .map((s) => {
      const article = s.keyword.articles[0] ?? null
      const hasArticle = !!article
      const gapType: 'no_content' | 'weak_content' = hasArticle ? 'weak_content' : 'no_content'
      // 優先度 = impressions × positional_decay（上位に近いほど高い）
      const positionalDecay = Math.max(0, 1 - (s.position - 10) / 40)
      const priority = Math.round(s.impressions * positionalDecay)
      return {
        keywordId: s.keywordId,
        keywordText: s.keyword.text,
        intent: s.keyword.intent,
        position: s.position,
        impressions: s.impressions,
        clicks: s.clicks,
        ctr: s.ctr,
        hasArticle,
        articleTitle: article?.title ?? null,
        articleStatus: article?.status ?? null,
        gapType,
        priority,
      }
    })
    .sort((a, b) => b.priority - a.priority)

  // intent 別サマリー
  type IntentSummary = {
    intent: string | null
    total: number
    noContent: number
    weakContent: number
    totalImpressions: number
    topPosition: number
  }
  const intentMap = new Map<string | null, IntentSummary>()
  for (const g of gaps) {
    const key = g.intent
    if (!intentMap.has(key)) {
      intentMap.set(key, {
        intent: key,
        total: 0,
        noContent: 0,
        weakContent: 0,
        totalImpressions: 0,
        topPosition: 999,
      })
    }
    const s = intentMap.get(key)!
    s.total++
    if (g.gapType === 'no_content') s.noContent++
    else s.weakContent++
    s.totalImpressions += g.impressions
    if (g.position < s.topPosition) s.topPosition = g.position
  }
  const intentSummaries = [...intentMap.values()].sort(
    (a, b) => b.totalImpressions - a.totalImpressions,
  )

  const totalGaps = gaps.length
  const noContentCount = gaps.filter((g) => g.gapType === 'no_content').length
  const top20 = gaps.slice(0, 20)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">競合コンテンツ差分分析</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            データ: {latestSnap.snapshotDate.toLocaleDateString('ja-JP')} ／
            順位 11 位以下のキーワードを競合に負けているコンテンツギャップとして分析
          </p>
        </div>
        {totalGaps > 0 && (
          <Badge variant="destructive" className="text-sm">
            {totalGaps} 件のギャップ
          </Badge>
        )}
      </div>

      {gaps.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="コンテンツギャップがありません"
          description="すべてのキーワードが TOP10 圏内です。"
        />
      ) : (
        <div className="space-y-6">
          {/* インテント別サマリーカード */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              コンテンツカテゴリー別ギャップ
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {intentSummaries.map((s) => {
                const intentKey = s.intent ?? ''
                const label = INTENT_LABELS[intentKey] ?? (intentKey || '未分類')
                const colorClass = INTENT_COLORS[intentKey] ?? 'bg-muted/60 text-muted-foreground border-border'
                return (
                  <Card key={intentKey} className="overflow-hidden">
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="flex items-center justify-between text-sm">
                        <span>{label}</span>
                        <Badge variant="outline" className={`text-xs ${colorClass}`}>
                          {s.total} 件
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">記事なし</p>
                          <p className="font-semibold text-destructive">{s.noContent}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">記事あり(弱)</p>
                          <p className="font-semibold text-amber-600 dark:text-amber-400">{s.weakContent}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">表示回数合計</p>
                          <p className="font-semibold">{s.totalImpressions.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">最高順位</p>
                          <p className="font-semibold">{s.topPosition.toFixed(1)}</p>
                        </div>
                      </div>
                      {s.noContent > 0 && (
                        <Link
                          href={`/dashboard/seo/keywords?intent=${intentKey}`}
                          className="mt-3 block text-xs text-primary hover:underline"
                        >
                          記事を生成 →
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* 優先度上位ギャップ一覧 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-destructive" />
                優先対応ギャップ（上位 {top20.length} 件）
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                表示回数 × 順位ポテンシャルで優先度を算出。上位から対応することでインパクトが最大化されます。
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>キーワード</TableHead>
                    <TableHead className="text-right">順位</TableHead>
                    <TableHead className="text-right">表示回数</TableHead>
                    <TableHead>コンテンツ状態</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top20.map((g) => (
                    <TableRow key={g.keywordId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{g.keywordText}</span>
                          {g.intent && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${INTENT_COLORS[g.intent] ?? ''}`}
                            >
                              {INTENT_LABELS[g.intent] ?? g.intent}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {g.position.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {g.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {g.gapType === 'no_content' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                            <AlertCircle className="h-3 w-3" />
                            記事なし
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                              <FileText className="h-3 w-3" />
                              強化が必要
                            </span>
                            {g.articleTitle && (
                              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                                {g.articleTitle}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <GenerateArticleButton
                          keywordId={g.keywordId}
                          keyword={g.keywordText}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
