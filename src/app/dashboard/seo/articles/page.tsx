import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: '記事ドラフト — SEO' }
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { listArticles } from '@/modules/seo'
import type { ComparisonService } from '@/modules/seo/article-service'
import { prisma } from '@/lib/db/client'
import ArticleActions from './article-actions'
import RegenerateArticleButton from './regenerate-article-button'
import DiagramPanel from './diagram-panel'
import CopyButton from '@/components/copy-button'
import EmptyState from '@/components/empty-state'
import { FileText, TrendingUp, Clock, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CtaEntry = { content: string; label: string }
type TableEntry = { htmlContent: string; title: string }

/** プレビュー用: [cta] → バッジ、[diagram] → バッジ、[table] → 実際のHTMLテーブル */
function renderDraftPreview(
  draft: string,
  ctaMap: Map<string, CtaEntry>,
  tableMap: Map<string, TableEntry>,
): string {
  return draft
    .replace(/\[cta:([a-z0-9_-]+)\]/g, (_match, shortcode) => {
      const label = ctaMap.get(shortcode)?.label ?? shortcode
      return `<div class="cta-placeholder">📣 CTA: ${label}</div>`
    })
    .replace(/\[diagram:([a-z0-9_-]+)\]/g, (_match, marker) => {
      return `<div class="cta-placeholder">📊 図解: ${marker}</div>`
    })
    .replace(/\[table:([a-z0-9_-]+)\]/g, (_match, marker) => {
      const entry = tableMap.get(marker)
      if (!entry) return `<div class="cta-placeholder">📋 表: ${marker}</div>`
      return `<figure class="not-prose my-4"><figcaption class="mb-1 text-center text-xs text-muted-foreground">${entry.title}</figcaption>${entry.htmlContent}</figure>`
    })
}

/** コピー用: [cta:xxx] / [table:xxx] を実際のHTMLに置換（[diagram:xxx]はそのまま除去） */
function renderDraftForCopy(
  draft: string,
  ctaMap: Map<string, CtaEntry>,
  tableMap: Map<string, TableEntry>,
): string {
  return draft
    .replace(/\[cta:([a-z0-9_-]+)\]/g, (_match, shortcode) => {
      return ctaMap.get(shortcode)?.content ?? `[cta:${shortcode}]`
    })
    .replace(/\[table:([a-z0-9_-]+)\]/g, (_match, marker) => {
      return tableMap.get(marker)?.htmlContent ?? ''
    })
    .replace(/\[diagram:[a-z0-9_-]+\]/g, '') // 図解はWordPress側で処理済みなので除去
}

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

const PAGE_SIZE = 20

type Props = {
  params?: Promise<{ projectId?: string }>
  searchParams: Promise<{ status?: string; page?: string }>
}

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

export default async function ArticlesPage({ params, searchParams }: Props) {
  const { projectId } = (await params) ?? {}
  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')

  const { status, page: pageParam } = await searchParams
  const page = parseInt(pageParam ?? '1', 10)

  const projectFilter = projectId ? { projectId } : {}
  const basePath = projectId ? `/dashboard/p/${projectId}/seo` : '/dashboard/seo'

  const [{ articles, total: filteredTotal }, statusCounts, ctaBlocks, brandProfile] = await Promise.all([
    listArticles(ctx.tenant.id, status || undefined, page, projectId),
    prisma.seoArticle.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenant.id, ...projectFilter },
      _count: true,
    }),
    prisma.ctaBlock.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { shortcode: true, content: true, label: true },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.brandProfile as any).findFirst({
      where: { tenantId: ctx.tenant.id },
      select: { brandColors: true },
    }) as Promise<{ brandColors: unknown } | null>,
  ])

  type BrandColors = { primary: string; secondary: string; accent: string; background: string; text: string }
  const brandColors = (brandProfile as { brandColors?: unknown } | null)?.brandColors as BrandColors | null ?? null

  const ctaMap = new Map(ctaBlocks.map((b) => [b.shortcode, { content: b.content, label: b.label }]))

  const total = statusCounts.reduce((s, c) => s + c._count, 0)
  const countByStatus = Object.fromEntries(statusCounts.map((c) => [c.status, c._count]))
  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE)

  const approved = countByStatus['APPROVED'] ?? 0
  const rejected = countByStatus['REJECTED'] ?? 0
  const pending = countByStatus['PENDING'] ?? 0
  const decided = approved + rejected
  const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : null

  function buildHref(p: number) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">記事ドラフト</h1>
          {pending > 0 && (
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
              {pending} 件が承認待ちです — レビューしてください
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && approvalRate !== null && (
            <span className={cn(
              'text-xs font-medium',
              approvalRate >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                : approvalRate >= 40 ? 'text-amber-600 dark:text-amber-400'
                : 'text-destructive',
            )}>
              承認率 {approvalRate}%
            </span>
          )}
          <Link
            href={`${basePath}/articles/new`}
            className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
          >
            + 記事を作成
          </Link>
        </div>
      </div>

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
            <Link href={`${basePath}/opportunities`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
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
          {articles.map((article) => {
            const age = daysAgo(article.createdAt)
            const isStale = article.status === 'PENDING' && age >= 3
            return (
            <Card key={article.id} className={cn(isStale && 'border-amber-300/60 dark:border-amber-700/40')}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">{article.title}</p>
                    {article.keyword && (
                      <p className="text-xs text-muted-foreground">
                        キーワード: {article.keyword.text}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {article.createdAt.toLocaleDateString('ja-JP')}
                      </p>
                      {isStale && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          <Clock className="h-3 w-3" />
                          {age}日待機
                        </span>
                      )}
                    </div>
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
                {(article.seoTitle || article.seoDescription) && (
                  <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEOメタ情報</p>
                    {article.seoTitle && (
                      <div>
                        <span className="text-xs text-muted-foreground">SEO Title: </span>
                        <span className="text-sm font-medium">{article.seoTitle}</span>
                        <span className="ml-1 text-xs text-muted-foreground">({article.seoTitle.length}文字)</span>
                      </div>
                    )}
                    {article.seoDescription && (
                      <div>
                        <span className="text-xs text-muted-foreground">Description: </span>
                        <span className="text-sm">{article.seoDescription}</span>
                        <span className="ml-1 text-xs text-muted-foreground">({article.seoDescription.length}文字)</span>
                      </div>
                    )}
                  </div>
                )}
                {article.draft && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ドラフト</p>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none max-h-96 overflow-auto rounded-md bg-muted p-4 text-sm [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-2 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_.cta-placeholder]:rounded [&_.cta-placeholder]:bg-primary/10 [&_.cta-placeholder]:px-2 [&_.cta-placeholder]:py-1 [&_.cta-placeholder]:text-xs [&_.cta-placeholder]:text-primary"
                      dangerouslySetInnerHTML={{ __html: renderDraftPreview(article.draft, ctaMap, new Map(article.tables.map((t) => [t.marker, { htmlContent: t.htmlContent, title: t.title }]))) }}
                    />
                  </div>
                )}
                {(() => {
                  const cs = (article.analysis as { comparisonServices?: ComparisonService[] } | null)?.comparisonServices
                  return cs && cs.length > 0 ? (
                    <div className="space-y-2 border-t border-border pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">比較対象サービス</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {cs.map((s) => (
                          <div key={s.name} className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{s.name}</span>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline shrink-0"
                              >
                                公式サイト <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            <p className="text-xs text-muted-foreground">{s.company}</p>
                            <p className="text-xs">{s.description}</p>
                            {s.features.length > 0 && (
                              <ul className="flex flex-wrap gap-1 mt-1">
                                {s.features.slice(0, 3).map((f) => (
                                  <li key={f} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{f}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}
                <DiagramPanel
                  articleId={article.id}
                  diagrams={article.diagrams}
                  tables={article.tables}
                  featuredImageUrl={article.featuredImageUrl ?? null}
                  brandColors={brandColors}
                />
                <div className="flex items-center justify-between">
                  <RegenerateArticleButton articleId={article.id} />
                  {article.status === 'APPROVED' && article.draft && (
                    <CopyButton
                      text={renderDraftForCopy(
                        article.draft,
                        ctaMap,
                        new Map(article.tables.map((t) => [t.marker, { htmlContent: t.htmlContent, title: t.title }])),
                      )}
                      label="ドラフトをコピー"
                    />
                  )}
                </div>
                {article.status === 'PENDING' && (
                  <div className="border-t border-border pt-4">
                    <ArticleActions
                      articleId={article.id}
                      title={article.title}
                      brief={article.brief}
                      draft={article.draft}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
            )
          })}
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
