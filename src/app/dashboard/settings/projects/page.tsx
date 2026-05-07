import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import ProjectList from './project-list'
import CreateProjectDialog from './create-project-dialog'

export const metadata: Metadata = { title: 'プロジェクト管理 — 設定' }

export default async function ProjectsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const projects = await prisma.project.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, slug: true, ownDomain: true, isDefault: true, createdAt: true },
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">プロジェクト管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ドメイン・サイト単位でデータを分離して管理します
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      <ProjectList initialProjects={projects} />

      <p className="mt-4 text-xs text-muted-foreground">
        デフォルトプロジェクトは削除できません。プロジェクトを削除すると、紐付くすべての LLMO・SEO データも削除されます。
      </p>
    </div>
  )
}
