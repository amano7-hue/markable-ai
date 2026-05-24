import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: '記事ドラフト — SEO' }
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { listArticles } from '@/modules/seo'
import type { ComparisonService } from '@/modules/seo/article-service'
import { prisma } from '@/lib/db/client'
import RegenerateArticleButton from './regenerate-article-button'
import DeleteArticleButton from './delete-article-button'
import DiagramPanel from './diagram-panel'
import CopyButton from '@/components/copy-button'
import EmptyState from '@/components/empty-state'
import GeneratingBanner from './generating-banner'
import { TrendingUp, FileText, ExternalLink, Loader2 } from 'lucide-react'
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
    .replace(/\[diagram:[a-z0-9_-]+\]/g, '')
}

const PAGE_SIZE = 20

type Props = {
  params?: Promise<{ projectId?: string }>
  searchParams: Promise<{ page?: string; generating?: string; analyzing?: string }>
}

export default async function ArticlesPage({ params, searchParams }: Props) {
  const { projectId } = (await params) ?? {}
  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')

  const { page: pageParam, generating, analyzing } = await searchParams
  const page = parseInt(pageParam ?? '1', 10)

  const basePath = projectId ? `/dashboard/p/${projectId}/seo` : '/dashboard/seo'

  const [{ articles, stagingArticles, total: filteredTotal }, ctaBlocks, brandProfile] = await Promise.all([
    listArticles(ctx.tenant.id, undefined, page, projectId),
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
  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE)

  function buildHref(p: number) {
    const params = new URLSearchParams()
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div>
      {(generating === '1' || analyzing === '1' || stagingArticles.length > 0) && <GeneratingBanner />}

      {/* ANALYZING 記事カード */}
      {stagingArticles.length > 0 && (
        <div className="mb-5 space-y-2">
          {stagingArticles.map((a) => (
            <div
              key={a.id}
              className={[
                'flex items-center justify-between gap-4 rounded-lg border px-4 py-3',
                a.draftStage === 'FAILED'
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-blue-300/60 bg-blue-50/40 dark:border-blue-700/40 dark:bg-blue-950/20',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0">
                {a.draftStage === 'FAILED'
                  ? <span className="text-destructive text-sm">✕</span>
                  : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                }
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.keyword?.text && `キーワード: ${a.keyword.text} · `}
                    {a.draftStage === 'FAILED' ? '生成失敗' : '分析・生成中...'}
                  </p>
                </div>
              </div>
              {a.draftStage === 'FAILED' && (
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`${basePath}/articles/new`}
                    className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                  >
                    再作成
                  </a>
                  <DeleteArticleButton articleId={a.id} title={a.title} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">記事一覧</h1>
        <Link
          href={`${basePath}/articles/new`}
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
        >
          + 記事を作成
        </Link>
      </div>

      {articles.length === 0 ? (
        <EmptyState
          icon={filteredTotal === 0 ? TrendingUp : FileText}
          title={filteredTotal === 0 ? '記事がありません' : '記事がありません'}
          description={filteredTotal === 0 ? '「改善機会」ページからキーワードの記事を生成できます。' : undefined}
          action={filteredTotal === 0 ? (
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
                  <div className="flex items-center gap-1">
                    <RegenerateArticleButton articleId={article.id} />
                    <DeleteArticleButton articleId={article.id} title={article.title} />
                  </div>
                  {article.draft && (
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
