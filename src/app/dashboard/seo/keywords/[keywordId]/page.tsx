import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getKeyword, getKeywordHistory } from '@/modules/seo'

const INTENT_LABELS: Record<string, string> = {
  informational: '情報収集',
  commercial: '比較検討',
  navigational: 'ナビゲーション',
}
import DeleteKeywordButton from './delete-keyword-button'
import Sparkline from '@/components/sparkline'
import GenerateArticleButton from './generate-article-button'
import { cn } from '@/lib/utils'

type Props = { params: Promise<{ keywordId: string }> }

export default async function KeywordDetailPage({ params }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { keywordId } = await params
  const [keyword, history] = await Promise.all([
    getKeyword(ctx.tenant.id, keywordId),
    getKeywordHistory(ctx.tenant.id, keywordId, 30),
  ])

  if (!keyword) notFound()

  const latest = history[history.length - 1]
  const earliest = history[0]

  // 30日間の順位変化 (負の値 = 改善)
  const positionDelta = (() => {
    if (!latest?.position || !earliest?.position || latest.id === earliest.id) return null
    return latest.position - earliest.position
  })()

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/seo/keywords"
          className="mb-2 -ml-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← キーワード一覧
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{keyword.text}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {keyword.intent && (
                <Badge variant="outline" className="mr-2 text-xs">
                  {INTENT_LABELS[keyword.intent] ?? keyword.intent}
                </Badge>
              )}
              {!keyword.isActive && (
                <Badge variant="outline" className="text-xs text-muted-foreground">無効</Badge>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {latest && (
              <div className="text-right text-sm">
                <p className={cn(
                  'font-semibold text-lg',
                  latest.position !== null && latest.position <= 10
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : latest.position !== null && latest.position <= 30
                    ? 'text-amber-600 dark:text-amber-400'
                    : '',
                )}>
                  {latest.position?.toFixed(1) ?? '-'}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">位</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {latest.position === null
                    ? '最新順位'
                    : latest.position <= 3
                    ? 'TOP3'
                    : latest.position <= 10
                    ? 'TOP10'
                    : latest.position <= 30
                    ? '改善機会'
                    : '圏外'}
                </p>
                {positionDelta !== null && (
                  <p className={cn(
                    'mt-0.5 text-xs font-medium',
                    positionDelta < 0 ? 'text-emerald-600 dark:text-emerald-400'
                      : positionDelta > 0 ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}>
                    {positionDelta === 0 ? '±0 (30日)' : positionDelta < 0 ? `${positionDelta.toFixed(1)} 改善` : `+${positionDelta.toFixed(1)} 悪化`}
                  </p>
                )}
              </div>
            )}
            {latest?.position !== null && latest?.position !== undefined && latest.position > 10 && latest.position <= 30 && (
              <GenerateArticleButton keywordId={keywordId} keyword={keyword.text} />
            )}
            <DeleteKeywordButton keywordId={keywordId} />
          </div>
        </div>
      </div>

      {/* 順位トレンドチャート */}
      {history.length >= 2 && (() => {
        const ranked = history.filter((h) => h.position !== null)
        if (ranked.length < 2) return null
        return (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              順位トレンド
            </h2>
            <div className="rounded-lg border border-border p-4">
              <Sparkline
                data={ranked.map((h) => ({
                  label: h.snapshotDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                  // 順位は小さいほど良いので反転して描画
                  value: 100 - (h.position ?? 100),
                }))}
                height={80}
                color="hsl(142 76% 36%)"
                formatValue={() => {
                  const first = ranked[0].position ?? 100
                  const last = ranked[ranked.length - 1].position ?? 100
                  const diff = last - first
                  return diff === 0 ? '±0' : diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`
                }}
              />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                ※ グラフは上が順位良（低位）、下が順位悪（高位）を示します
              </p>
            </div>
          </section>
        )
      })()}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          推移（直近30日）
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">データなし。GSC 同期を実行してください。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>順位</TableHead>
                <TableHead>クリック</TableHead>
                <TableHead>表示回数</TableHead>
                <TableHead>CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...history].reverse().map((snap) => (
                <TableRow key={snap.id}>
                  <TableCell className="font-mono text-xs">
                    {snap.snapshotDate.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    {snap.position === null ? (
                      <Badge variant="outline">未取得</Badge>
                    ) : snap.position <= 3 ? (
                      <Badge variant="secondary">{snap.position.toFixed(1)}</Badge>
                    ) : snap.position <= 10 ? (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                        {snap.position.toFixed(1)}
                      </Badge>
                    ) : snap.position <= 30 ? (
                      <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">
                        {snap.position.toFixed(1)}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">{snap.position.toFixed(1)}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{snap.clicks ?? '-'}</TableCell>
                  <TableCell>{snap.impressions?.toLocaleString() ?? '-'}</TableCell>
                  <TableCell>
                    {snap.ctr !== null ? `${(snap.ctr * 100).toFixed(1)}%` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
