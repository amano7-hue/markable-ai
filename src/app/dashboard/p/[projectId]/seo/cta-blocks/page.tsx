import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import CtaBlocksManager from '@/app/dashboard/seo/cta-blocks/cta-blocks-manager'
import ProjectSwitcher from '@/components/project-switcher'

export const metadata: Metadata = { title: 'CTAブロック — SEO' }

export default async function CtaBlocksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/dashboard')

  const [blocks, projects] = await Promise.all([
    prisma.ctaBlock.findMany({
      where: { tenantId: ctx.tenant.id, projectId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.project.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, slug: true, ownDomain: true },
    }),
  ])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CTAブロック</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            記事内に挿入するCTAをショートコードで管理します。ONにしたブロックのみ記事生成で使用されます。
          </p>
        </div>
        <ProjectSwitcher
          projects={projects}
          currentProjectId={projectId}
          baseModule="seo/cta-blocks"
        />
      </div>
      <CtaBlocksManager initialBlocks={blocks} projectId={projectId} projects={projects} />
    </div>
  )
}
