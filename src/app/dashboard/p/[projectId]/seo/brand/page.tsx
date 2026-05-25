import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import BrandProfileForm from '@/app/dashboard/seo/brand/brand-profile-form'

export const metadata: Metadata = { title: 'ブランド設定 — SEO' }

export default async function BrandPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/dashboard')

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: ctx.tenant.id },
    include: { brandProfile: true },
  })
  const profile = project?.brandProfile

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">ブランド設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          記事生成時に適用するブランドトーン・NGワード・言い回しルールを設定します
        </p>
      </div>
      <BrandProfileForm
        projectId={project?.id}
        initialData={{
          tone: profile?.tone ?? '',
          companyDescription: profile?.companyDescription ?? '',
          ngWords: (profile?.ngWords as string[]) ?? [],
          preferredPhrases: (profile?.preferredPhrases as { from: string; to: string }[]) ?? [],
          diagramPreference: profile?.diagramPreference ?? '',
          diagramInstructions: profile?.diagramInstructions ?? '',
          imageStyleInstructions: profile?.imageStyleInstructions ?? '',
          decorationRules: (profile as { decorationRules?: string | null } | null)?.decorationRules ?? '',
          lineBreakRules: (profile as { lineBreakRules?: string | null } | null)?.lineBreakRules ?? '',
          referenceImageUrl: profile?.referenceImageUrl ?? '',
          brandColors: (profile?.brandColors as Record<string, string> | null) ?? null,
        }}
      />
    </div>
  )
}
