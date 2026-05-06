import type { Metadata } from 'next'
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
import { AlertTriangle, TrendingDown, Eye, MousePointerClick, ShieldAlert } from 'lucide-react'

export const metadata: Metadata = { title: 'テクニカル監査 — SEO' }

// CTR が低いとみなす閾値（業界平均より低い）
const LOW_CTR_THRESHOLD = 0.02  // 2%
// 表示回数が多いのに低CTRと判断する最低impressions
const MIN_IMPRESSIONS_FOR_CTR_AUDIT = 100
// 順位が悪化したとみなす差分（前回より何位悪化したか）
const POSITION_DROP_THRESHOLD = 3

export default async function SeoAuditPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const tenantId = ctx.tenant.id

  // 最新と1つ前のスナップショット日を取得
  const recentDates = await prisma.seoKeywordSnapshot.findMany({
    where: { tenantId },
    select: { snapshotDate: true },
    distinct: ['snapshotDate'],
    orderBy: { snapshotDate: 'desc' },
    take: 2,
  })

  const latestDate = recentDates[0]?.snapshotDate ?? null
  const previousDate = recentDates[1]?.snapshotDate ?? null

  if (!latestDate) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">テクニカル監査</h1>
        <EmptyState
          icon={ShieldAlert}
          title="GSC データがありません"
          description="キーワードを同期してから監査を実行してください。"
        />
      </div>
    )
  }

  // 最新スナップショット全件取得
  const latestSnaps = await prisma.seoKeywordSnapshot.findMany({
    where: { tenantId, snapshotDate: latestDate },
    include: { keyword: { select: { id: true, text: true, intent: true } } },
  })

  // 1. 高インプレッション・低CTR（機会損失キーワード）
  const lowCtrIssues = latestSnaps
    .filter(
      (s) =>
        s.impressions >= MIN_IMPRESSIONS_FOR_CTR_AUDIT &&
        s.ctr < LOW_CTR_THRESHOLD &&
        s.position <= 20,
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)

  // 2. 順位下降キーワード（前スナップショットと比較）
  type DropIssue = {
    keywordId: string
    text: string
    intent: string | null
    latestPosition: number
    previousPosition: number
    drop: number
    impressions: number
  }
  let dropIssues: DropIssue[] = []

  if (previousDate) {
    const previousSnaps = await prisma.seoKeywordSnapshot.findMany({
      where: { tenantId, snapshotDate: previousDate },
    })
    const prevMap = new Map(previousSnaps.map((s) => [s.keywordId, s]))

    dropIssues = latestSnaps
      .flatMap((s) => {
        const prev = prevMap.get(s.keywordId)
        if (!prev) return []
        const drop = s.position - prev.position // positive = rank number increased = worse
        if (drop < POSITION_DROP_THRESHOLD) return []
        return [{
          keywordId: s.keywordId,
          text: s.keyword.text,
          intent: s.keyword.intent,
          latestPosition: s.position,
          previousPosition: prev.position,
          drop,
          impressions: s.impressions,
        }]
      })
      .sort((a, b) => b.drop - a.drop)
      .slice(0, 15)
  }

  // 3. 圏外（31位以下）なのに多くのインプレッションがあるキーワード
  const outOfRangeIssues = latestSnaps
    .filter((s) => s.position > 30 && s.impressions >= 50)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10)

  const totalIssues = lowCtrIssues.length + dropIssues.length + outOfRangeIssues.length
  const lastSyncDays = Math.floor((Date.now() - latestDate.getTime()) / 86_400_000)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">テクニカル監査</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            最終データ: {latestDate.toLocaleDateString('ja-JP')}
            {lastSyncDays > 0 && ` (${lastSyncDays}日前)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalIssues > 0 ? (
            <Badge variant="destructive" className="text-sm">
              {totalIssues} 件の課題
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              課題なし
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* 1. 高インプレッション・低CTR */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MousePointerClick className="h-4 w-4 text-amber-500" />
              高インプレッション・低CTR
              {lowCtrIssues.length > 0 && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {lowCtrIssues.length} 件
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              表示回数 {MIN_IMPRESSIONS_FOR_CTR_AUDIT} 以上で CTR {(LOW_CTR_THRESHOLD * 100).toFixed(0)}% 未満 (20位以内)。
              タイトル・ディスクリプションの改善が効果的です。
            </p>
          </CardHeader>
          <CardContent>
            {lowCtrIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">該当キーワードなし</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>キーワード</TableHead>
                    <TableHead className="text-right">順位</TableHead>
                    <TableHead className="text-right">表示回数</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowCtrIssues.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.keyword.text}</span>
                          {s.keyword.intent && (
                            <Badge variant="outline" className="text-xs">
                              {s.keyword.intent}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{s.position.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        {s.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400 font-medium">
                        {(s.ctr * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 2. 順位下降 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-destructive" />
              順位下降キーワード
              {dropIssues.length > 0 && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {dropIssues.length} 件
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {previousDate
                ? `${previousDate.toLocaleDateString('ja-JP')} → ${latestDate.toLocaleDateString('ja-JP')} で ${POSITION_DROP_THRESHOLD} 位以上悪化したキーワード`
                : '比較する前回スナップショットがありません'}
            </p>
          </CardHeader>
          <CardContent>
            {!previousDate ? (
              <p className="text-sm text-muted-foreground">
                2回以上の同期が完了すると比較データが表示されます。
              </p>
            ) : dropIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">順位の下降は検出されませんでした</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>キーワード</TableHead>
                    <TableHead className="text-right">前回</TableHead>
                    <TableHead className="text-right">最新</TableHead>
                    <TableHead className="text-right">変動</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dropIssues.map((d) => (
                    <TableRow key={d.keywordId}>
                      <TableCell>
                        <span className="font-medium">{d.text}</span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {d.previousPosition.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.latestPosition.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">
                        +{d.drop.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 3. 圏外・高インプレッション */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-blue-500" />
              圏外・高ポテンシャル
              {outOfRangeIssues.length > 0 && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {outOfRangeIssues.length} 件
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              31位以下でも表示回数が多いキーワード。コンテンツ強化でトップページ入りが期待できます。
            </p>
          </CardHeader>
          <CardContent>
            {outOfRangeIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">該当キーワードなし</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>キーワード</TableHead>
                    <TableHead className="text-right">順位</TableHead>
                    <TableHead className="text-right">表示回数</TableHead>
                    <TableHead className="text-right">クリック</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outOfRangeIssues.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.keyword.text}</span>
                          {s.keyword.intent && (
                            <Badge variant="outline" className="text-xs">
                              {s.keyword.intent}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {s.position.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{s.clicks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
