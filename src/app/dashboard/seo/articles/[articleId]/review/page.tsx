import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import ReviewHeadingsForm from './review-headings-form'

export const metadata: Metadata = { title: '構成レビュー — SEO記事' }

type Params = Promise<{ articleId: string; projectId?: string }>

export default async function ReviewArticlePage({ params }: { params: Params }) {
  const { articleId, projectId } = await params
  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')

  const article = await prisma.seoArticle.findFirst({
    where: { id: articleId, tenantId: ctx.tenant.id, draftStage: 'REVIEWING' },
    select: { id: true, title: true, analysis: true, projectId: true },
  })
  if (!article) notFound()

  type AnalysisInput = {
    stage: string
    keyword: string
    projectId?: string
    ownInsights?: string
    relatedKeywords?: string
    avoidSensationalHeadings?: boolean
    trustedSourcesOnly?: boolean
  }
  type AnalysisResult = {
    reader: {
      targetAudience: string
      searchIntent: string
      keyQuestions: string[]
      painPoints: string[]
      relatedQuestions: string[]
      relatedSearches: string[]
    }
    competitor: { recommendedWordCount: number; averageWordCount: number; reasoning: string }
    headings: { h1: string; sections: Array<{ h2: string; h3s: string[] }> }
  } & AnalysisInput

  const analysis = article.analysis as AnalysisResult | null
  if (!analysis?.reader) {
    // まだ分析中の場合はリダイレクト
    const basePath = projectId ? `/dashboard/p/${projectId}/seo` : '/dashboard/seo'
    redirect(`${basePath}/articles?analyzing=1`)
  }

  const basePath = projectId ? `/dashboard/p/${projectId}/seo` : '/dashboard/seo'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <a href={`${basePath}/articles`} className="hover:text-foreground">記事ドラフト</a>
          <span>/</span>
          <span>構成レビュー</span>
        </div>
        <h1 className="text-2xl font-semibold">構成レビュー</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI が提案した見出し構成を確認・編集してから記事生成を実行してください。
        </p>
      </div>
      <ReviewHeadingsForm
        articleId={article.id}
        title={article.title}
        projectId={article.projectId ?? projectId}
        analysis={analysis}
        basePath={basePath}
      />
    </div>
  )
}
