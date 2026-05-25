import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import WritingRulesForm from './writing-rules-form'

export const metadata: Metadata = { title: 'ライティングルール — プロジェクト設定' }

export default async function WritingRulesPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: ctx.tenant.id },
    include: { brandProfile: true },
  })
  if (!project) redirect('/dashboard')

  const profile = project.brandProfile as {
    decorationRules?: string | null
    lineBreakRules?: string | null
  } | null

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">ライティングルール</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          記事生成時に適用するHTML装飾・改行のルールをプロジェクトごとに設定します
        </p>
      </div>
      <WritingRulesForm
        projectId={projectId}
        initialDecorationRules={profile?.decorationRules ?? ''}
        initialLineBreakRules={profile?.lineBreakRules ?? ''}
      />
    </div>
  )
}
