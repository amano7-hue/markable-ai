import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: '記事ドラフト — SEO' }
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { listArticles } from '@/modules/seo'
import { prisma } from '@/lib/db/client'
import ArticleActions from './article-actions'
import CopyButton from '@/components/copy-button'
import EmptyState from '@/components/empty-state'
import { FileText, TrendingUp } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

const PAGE_SIZE = 20

type Props = { searchParams: Promise<{ status?: string; page?: string }> }

const STATUS_LABELS: Record<string, string> = {
  PENDING: '承認待ち',
  APPROVED: '承認済み',
  REJECTED: '却下',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'default',
  APPROVED: 'secondary',
  REJECTED: 'destructive',
}

const FILTER_TABS = [
  { value: '', label: 'すべて' },
  { value: 'PENDING', label: '承認待ち' },
  { value: 'APPROVED', label: '承認済み' },
  { value: 'REJECTED', label: '却下' },
]

export default async function ArticlesPage({ searchParams }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { status, page: pageParam } = await searchParams
  const page = parseInt(pageParam ?? '1', 10)

  const [{ articles, total: filteredTotal }, statusCounts] = await Promise.all([
    listArticles(ctx.tenant.id, status || undefined, page),
    prisma.seoArticle.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
  ])

  const total = statusCounts.reduce((s, c) => s + c._count, 0)
  const countByStatus = Object.fromEntries(statusCounts.map((c) => [c.status, c._count]))
  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE)

  function buildHref(p: number) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">記事ドラフト</h1>

      {/* フィルタータブ */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {FILTER_TABS.map((tab) => {
          const isActive = (status ?? '') === tab.value
          const count = tab.value === '' ? total : (countByStatus[tab.value] ?? 0)
          return (
            <Link
              key={tab.value}
              href={tab.value ? `?status=${tab.value}` : '?'}
              className={[
                'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
                isActive
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tab.label}
              {count > 0 && (
                <span className={[
                  'rounded-full px-1.5 py-0.5 text-xs',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                ].join(' ')}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {articles.length === 0 ? (
        <EmptyState
          icon={total === 0 ? TrendingUp : FileText}
          title={total === 0 ? '記事ドラフトがありません' : 'このステータスの記事ドラフトはありません'}
          description={total === 0 ? '「改善機会」ページからキーワードの記事を生成できます。' : undefined}
          action={total === 0 ? (
            <Link href="/dashboard/seo/opportunities" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              改善機会を見る
            </Link>
          ) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filteredTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              {filteredTotal} 件中 {(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, filteredTotal)} 件を表示
            </p>
          )}
          {articles.map((article) => (
            <Card key={article.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">{article.title}</p>
                    {article.keyword && (
                      <p className="text-xs text-muted-foreground">
                        キーワード: {article.keyword.text}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {article.createdAt.toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[article.status] ?? 'outline'}>
                    {STATUS_LABELS[article.status] ?? article.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ブリーフ</p>
                  <p className="rounded-md bg-muted p-3 text-sm">{article.brief}</p>
                </div>
                {article.draft && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ドラフト</p>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm font-sans">
                      {article.draft}
                    </pre>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    {article.status === 'PENDING' && (
                      <ArticleActions articleId={article.id} />
                    )}
                  </div>
                  {article.status === 'APPROVED' && article.draft && (
                    <CopyButton text={article.draft} label="ドラフトをコピー" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Link
                href={buildHref(page - 1)}
                aria-disabled={page <= 1}
                className={`text-sm px-3 py-1.5 rounded-md border ${
                  page <= 1
                    ? 'pointer-events-none opacity-40 border-transparent'
                    : 'border-border hover:bg-accent'
                }`}
              >
                ← 前のページ
              </Link>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages} ページ
              </span>
              <Link
                href={buildHref(page + 1)}
                aria-disabled={page >= totalPages}
                className={`text-sm px-3 py-1.5 rounded-md border ${
                  page >= totalPages
                    ? 'pointer-events-none opacity-40 border-transparent'
                    : 'border-border hover:bg-accent'
                }`}
              >
                次のページ →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
