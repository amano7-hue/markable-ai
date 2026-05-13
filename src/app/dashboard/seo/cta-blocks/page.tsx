import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import CtaBlocksManager from './cta-blocks-manager'

export const metadata: Metadata = { title: 'CTAブロック設定' }

export default async function CtaBlocksPage({ params }: { params?: Promise<{ projectId?: string }> }) {
  const { projectId } = (await params) ?? {}
  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')

  const blocks = await prisma.ctaBlock.findMany({
    where: projectId
      ? { tenantId: ctx.tenant.id, projectId }
      : { tenantId: ctx.tenant.id },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">CTAブロック</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          記事内に挿入するCTAをショートコードで管理します。記事生成時に自動で組み込まれます。
        </p>
      </div>
      <CtaBlocksManager initialBlocks={blocks} projectId={projectId} />
    </div>
  )
}
