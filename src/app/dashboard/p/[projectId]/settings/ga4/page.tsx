import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import Ga4ChannelFilterForm from './ga4-channel-filter-form'

export const metadata: Metadata = { title: 'GA4チャンネルフィルター — プロジェクト設定' }

export default async function Ga4ChannelFilterPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: ctx.tenant.id },
    select: { id: true, ga4ChannelFilter: true },
  })
  if (!project) redirect('/dashboard')

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">GA4 チャンネルフィルター</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          セッション集計に含めるデフォルトチャンネルグループを選択します。未選択の場合は全チャンネルが対象です。
        </p>
      </div>
      <Ga4ChannelFilterForm
        projectId={project.id}
        initialFilter={(project.ga4ChannelFilter as string[]) ?? []}
      />
    </div>
  )
}
