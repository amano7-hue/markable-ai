import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { FolderOpen, Globe, Bot, Hash, Settings, Plus, ExternalLink } from 'lucide-react'

export const metadata: Metadata = { title: 'プロジェクト一覧' }

export default async function ProjectsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const projects = await prisma.project.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      ownDomain: true,
      isDefault: true,
      createdAt: true,
      _count: {
        select: {
          aeoPrompts: { where: { isActive: true } },
          seoKeywords: { where: { isActive: true } },
          aeoSnapshots: true,
        },
      },
    },
  })

  // 各プロジェクトの承認待ち数
  const pendingByProject = await prisma.approvalItem.groupBy({
    by: ['projectId'],
    where: {
      tenantId: ctx.tenant.id,
      status: 'PENDING',
      projectId: { in: projects.map((p) => p.id) },
    },
    _count: true,
  })
  const pendingMap = Object.fromEntries(
    pendingByProject.map((r) => [r.projectId ?? '', r._count])
  )

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">プロジェクト一覧</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ドメイン・サイト単位で LLMO・SEO データを管理します
          </p>
        </div>
        <Link
          href="/dashboard/settings/projects"
          className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          プロジェクト設定
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded border border-dashed border-border py-12 text-center">
          <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">プロジェクトがありません</p>
          <Link
            href="/dashboard/settings/projects"
            className="mt-3 inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            プロジェクトを作成
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => {
            const pending = pendingMap[project.id] ?? 0
            return (
              <div
                key={project.id}
                className="rounded border border-border bg-card overflow-hidden"
              >
                {/* ヘッダー */}
                <div className="border-b border-border px-4 py-3 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{project.name}</span>
                      {project.isDefault && (
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          デフォルト
                        </span>
                      )}
                      {pending > 0 && (
                        <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          承認待 {pending}
                        </span>
                      )}
                    </div>
                    {project.ownDomain && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        {project.ownDomain}
                      </p>
                    )}
                  </div>
                </div>

                {/* 統計 */}
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-lg font-semibold tabular-nums leading-none">
                      {project._count.aeoPrompts}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">プロンプト</p>
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-lg font-semibold tabular-nums leading-none">
                      {project._count.seoKeywords}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">キーワード</p>
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-lg font-semibold tabular-nums leading-none">
                      {project._count.aeoSnapshots}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">スナップショット</p>
                  </div>
                </div>

                {/* ナビリンク */}
                <div className="flex divide-x divide-border">
                  <Link
                    href={`/dashboard/p/${project.id}/llmo`}
                    className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    LLMO
                  </Link>
                  <Link
                    href={`/dashboard/p/${project.id}/seo`}
                    className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <Hash className="h-3.5 w-3.5" />
                    SEO
                  </Link>
                  {project.ownDomain && (
                    <a
                      href={`https://${project.ownDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      サイト
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
