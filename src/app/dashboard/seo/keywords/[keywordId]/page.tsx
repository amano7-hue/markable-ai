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
                <Badge variant="outline" className="mr-2 text-xs">{keyword.intent}</Badge>
              )}
              {!keyword.isActive && (
                <Badge variant="outline" className="text-xs text-muted-foreground">無効</Badge>
              )}
            </p>
          </div>
          {latest && (
            <div className="text-right text-sm">
              <p className="font-semibold text-lg">{latest.position?.toFixed(1) ?? '-'}<span className="ml-1 text-xs font-normal text-muted-foreground">位</span></p>
              <p className="text-xs text-muted-foreground">最新順位</p>
            </div>
          )}
        </div>
      </div>

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
