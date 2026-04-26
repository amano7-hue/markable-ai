import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'キーワード — SEO' }
import EmptyState from '@/components/empty-state'
import { Hash } from 'lucide-react'
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
import type { KeywordSortKey } from '@/modules/seo'
import { prisma } from '@/lib/db/client'
import SyncKeywordsButton from './sync-keywords-button'

type Props = { searchParams: Promise<{ sort?: string; page?: string; intent?: string }> }

const INTENT_LABELS: Record<string, string> = {
  informational: '情報収集',
  commercial: '比較検討',
  navigational: 'ナビゲーション',
}

const SORT_OPTIONS: { value: KeywordSortKey; label: string }[] = [
  { value: 'created', label: '追加日' },
  { value: 'position', label: '順位（良い順）' },
  { value: 'impressions', label: '表示回数' },
]

function positionBadge(pos: number | null) {
  if (pos === null) return <Badge variant="outline">未取得</Badge>
  if (pos <= 3) return <Badge variant="secondary">{pos.toFixed(1)}</Badge>
  if (pos <= 10) return <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">{pos.toFixed(1)}</Badge>
  if (pos <= 30) return <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">{pos.toFixed(1)}</Badge>
  return <Badge variant="destructive">{pos.toFixed(1)}</Badge>
}

function buildHref(params: { sort?: string; page?: number; intent?: string }) {
  const qs = new URLSearchParams()
  if (params.sort && params.sort !== 'created') qs.set('sort', params.sort)
  if (params.page && params.page > 1) qs.set('page', String(params.page))
  if (params.intent) qs.set('intent', params.intent)
  const str = qs.toString()
  return str ? `?${str}` : '?'
}

const PAGE_SIZE = 50

export default async function KeywordsPage({ searchParams }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { sort: rawSort, page: rawPage, intent } = await searchParams
  const sort = (rawSort ?? 'created') as KeywordSortKey
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1)

  const [{ keywords, total }, intentCounts] = await Promise.all([
    listKeywords(ctx.tenant.id, { sort, page, intent: intent || undefined }),
    prisma.seoKeyword.groupBy({
      by: ['intent'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
  ])

  const totalCount = intentCounts.reduce((s, c) => s + c._count, 0)
  const countByIntent = Object.fromEntries(intentCounts.map((c) => [c.intent ?? '', c._count]))
  const hasIntentData = intentCounts.some((c) => c.intent !== null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">キーワード一覧</h1>
        <div className="flex items-center gap-2">
          <SyncKeywordsButton />
          <Link
            href="/dashboard/seo/keywords/new"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            + 追加
          </Link>
        </div>
      </div>

      {/* インテント フィルター */}
      {hasIntentData && (
        <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
          <Link
            href={buildHref({ sort, page: 1 })}
            className={[
              'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
              !intent
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            すべて
            <span className={['rounded-full px-1.5 py-0.5 text-xs', !intent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'].join(' ')}>
              {totalCount}
            </span>
          </Link>
          {Object.entries(INTENT_LABELS).map(([val, label]) => {
            const isActive = intent === val
            const count = countByIntent[val] ?? 0
            if (count === 0) return null
            return (
              <Link
                key={val}
                href={buildHref({ sort, page: 1, intent: val })}
                className={[
                  'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
                  isActive
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {label}
                <span className={['rounded-full px-1.5 py-0.5 text-xs', isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'].join(' ')}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* ソート */}
      {total > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">並び替え:</span>
          {SORT_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={buildHref({ sort: opt.value, page: 1, intent: intent || undefined })}
              className={[
                'rounded-md px-2 py-1 transition-colors',
                sort === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              ].join(' ')}
            >
              {opt.label}
            </Link>
          ))}
          <span className="ml-auto text-muted-foreground">{total} 件</span>
        </div>
      )}

      {keywords.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="キーワードがありません"
          description="「+ 追加」から手動登録するか、GSC 同期を実行してください。"
          action={
            <Link
              href="/dashboard/seo/keywords/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              + 追加
            </Link>
          }
        />
      ) : (
        <>
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
                      <Link
                        href={`/dashboard/seo/keywords/${k.id}`}
                        className={`hover:underline ${k.isActive ? '' : 'text-muted-foreground'}`}
                      >
                        {k.text}
                      </Link>
                      {k.intent && (
                        <Badge variant="outline" className="text-xs">
                          {INTENT_LABELS[k.intent] ?? k.intent}
                        </Badge>
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

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              {page > 1 && (
                <Link
                  href={buildHref({ sort, page: page - 1, intent: intent || undefined })}
                  className="rounded-md border border-border px-3 py-1 hover:bg-accent"
                >
                  ← 前へ
                </Link>
              )}
              <span className="text-muted-foreground">
                {page} / {totalPages} ページ
              </span>
              {page < totalPages && (
                <Link
                  href={buildHref({ sort, page: page + 1, intent: intent || undefined })}
                  className="rounded-md border border-border px-3 py-1 hover:bg-accent"
                >
                  次へ →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
