import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { listArticles } from '@/modules/seo'
import ArticleActions from './article-actions'

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

export default async function ArticlesPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const articles = await listArticles(ctx.tenant.id)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">記事ドラフト</h1>

      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          記事ドラフトがありません。「改善機会」ページから生成できます。
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
