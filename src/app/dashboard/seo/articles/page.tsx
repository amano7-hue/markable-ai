import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { listArticles } from '@/modules/seo'
import { prisma } from '@/lib/db/client'
import ArticleActions from './article-actions'

type Props = { searchParams: Promise<{ status?: string }> }

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

  const { status } = await searchParams

  const [articles, statusCounts] = await Promise.all([
    listArticles(ctx.tenant.id, status || undefined),
    prisma.seoArticle.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
  ])

  const total = statusCounts.reduce((s, c) => s + c._count, 0)
  const countByStatus = Object.fromEntries(statusCounts.map((c) => [c.status, c._count]))

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
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? '記事ドラフトがありません。「改善機会」ページから生成できます。'
            : 'このステータスの記事ドラフトはありません。'}
        </p>
      ) : (
        <div className="space-y-4">
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
                {article.status === 'PENDING' && (
                  <ArticleActions articleId={article.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
