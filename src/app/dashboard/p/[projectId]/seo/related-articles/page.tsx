import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import RelatedArticlesManager from './related-articles-manager'

export const metadata: Metadata = { title: '関連記事リンク管理 — SEO' }

export default async function RelatedArticlesPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const links = await prisma.projectArticleLink.findMany({
    where: { tenantId: ctx.tenant.id, projectId },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">関連記事リンク管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV / XLSX でプロジェクトの記事一覧を登録します。記事生成時にタイトルの類似度から自動的に関連記事リンクが挿入されます。
        </p>
      </div>
      <RelatedArticlesManager projectId={projectId} initialLinks={links} />
    </div>
  )
}
