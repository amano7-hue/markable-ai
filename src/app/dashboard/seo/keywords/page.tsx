import Link from 'next/link'
import { redirect } from 'next/navigation'
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
import { listKeywords } from '@/modules/seo'

function positionBadge(pos: number | null) {
  if (pos === null) return <Badge variant="outline">未取得</Badge>
  if (pos <= 3) return <Badge variant="secondary">{pos.toFixed(1)}</Badge>
  if (pos <= 10) return <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">{pos.toFixed(1)}</Badge>
  if (pos <= 30) return <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">{pos.toFixed(1)}</Badge>
  return <Badge variant="destructive">{pos.toFixed(1)}</Badge>
}

export default async function KeywordsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const keywords = await listKeywords(ctx.tenant.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">キーワード一覧</h1>
        <Link
          href="/dashboard/seo/keywords/new"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          + 追加
        </Link>
      </div>

      {keywords.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          キーワードがありません。「+ 追加」から登録するか、GSC 同期を実行してください。
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>キーワード</TableHead>
              <TableHead>順位</TableHead>
              <TableHead>クリック</TableHead>
              <TableHead>表示回数</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>最終同期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keywords.map((k) => (
              <TableRow key={k.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={k.isActive ? '' : 'text-muted-foreground'}>
                      {k.text}
                    </span>
                    {k.intent && (
                      <Badge variant="outline" className="text-xs">{k.intent}</Badge>
                    )}
                    {!k.isActive && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">無効</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{positionBadge(k.latestPosition)}</TableCell>
                <TableCell>{k.latestClicks ?? '-'}</TableCell>
                <TableCell>{k.latestImpressions?.toLocaleString() ?? '-'}</TableCell>
                <TableCell>
                  {k.latestCtr !== null
                    ? `${(k.latestCtr * 100).toFixed(1)}%`
                    : '-'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {k.lastSyncedAt
                    ? k.lastSyncedAt.toLocaleDateString('ja-JP')
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
