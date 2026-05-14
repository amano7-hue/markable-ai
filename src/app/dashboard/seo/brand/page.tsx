import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import BrandProfileForm from './brand-profile-form'

export const metadata: Metadata = { title: 'ブランド設定 — SEO' }

export default async function BrandPage({ params }: { params?: Promise<{ projectId?: string }> }) {
  const { projectId } = (await params) ?? {}
  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')

  const project = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, tenantId: ctx.tenant.id },
        include: { brandProfile: true },
      })
    : await prisma.project.findFirst({
        where: { tenantId: ctx.tenant.id },
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
        }}
      />
    </div>
  )
}
