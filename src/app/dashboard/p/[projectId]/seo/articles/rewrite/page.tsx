import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import RewriteArticleFlow from './rewrite-article-flow'

export const metadata: Metadata = { title: '既存記事リライト — SEO' }

export default async function RewriteArticlePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">既存記事リライト</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          URLまたは記事テキストをもとにSEO・LLMOの観点でリライト提案を生成します
        </p>
      </div>
      <RewriteArticleFlow projectId={projectId} />
    </div>
  )
}
