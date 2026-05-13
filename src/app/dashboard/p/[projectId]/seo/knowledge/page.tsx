import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/empty-state'
import { BookOpen, FileText, Globe, PenLine, Loader2 } from 'lucide-react'
import AddKnowledgeDialog from '@/app/dashboard/seo/knowledge/add-knowledge-dialog'
import DeleteKnowledgeButton from '@/app/dashboard/seo/knowledge/delete-knowledge-button'
import ProcessingPoller from '@/app/dashboard/seo/knowledge/processing-poller'
import KnowledgeActiveToggle from '@/app/dashboard/seo/knowledge/knowledge-active-toggle'
import ProjectSwitcher from '@/components/project-switcher'

export const metadata: Metadata = { title: 'ナレッジベース — SEO' }

const CATEGORY_LABELS: Record<string, string> = {
  case_study: '導入事例',
  service: 'サービス情報',
  company: '会社情報',
  other: 'その他',
}

const TYPE_ICONS = {
  URL: Globe,
  MANUAL: PenLine,
  PDF: FileText,
}

export default async function KnowledgePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/dashboard')

  const [sources, projects] = await Promise.all([
    prisma.knowledgeSource.findMany({
      where: { tenantId: ctx.tenant.id, projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        category: true,
        title: true,
        url: true,
        status: true,
        content: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.project.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, slug: true, ownDomain: true },
    }),
  ])

  const hasProcessing = sources.some((s) => s.status === 'processing')

  const countByCategory = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <ProcessingPoller hasProcessing={hasProcessing} />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ナレッジベース</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            記事生成時に参照する独自情報・事例・資料を登録します。ONにしたものだけが記事生成で使用されます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectSwitcher
            projects={projects}
            currentProjectId={projectId}
            baseModule="seo/knowledge"
          />
          <AddKnowledgeDialog projectId={projectId} projects={projects} />
        </div>
      </div>

      {sources.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(countByCategory).map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs">
              <span className="font-medium">{CATEGORY_LABELS[cat] ?? cat}</span>
              <span className="text-muted-foreground">{count}件</span>
            </div>
          ))}
        </div>
      )}

      {sources.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="ナレッジが登録されていません"
          description="URL・テキスト・PDF を登録すると、記事生成時に独自情報として活用されます"
          action={<AddKnowledgeDialog projectId={projectId} projects={projects} />}
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {sources.map((s) => {
            const Icon = TYPE_ICONS[s.type]
            return (
              <div key={s.id} className={`flex items-center justify-between gap-4 px-4 py-3 transition-opacity ${!s.isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground truncate block"
                      >
                        {s.url}
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {s.createdAt.toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.status === 'processing' && Date.now() - s.createdAt.getTime() < 10 * 60 * 1000 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      テキスト抽出中
                    </span>
                  ) : s.status === 'processing' || s.status === 'failed' ? (
                    <span
                      className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive cursor-help"
                      title={s.content?.startsWith('ERROR:') ? s.content : undefined}
                    >抽出失敗</span>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[s.category] ?? s.category}
                    </Badge>
                  )}
                  <KnowledgeActiveToggle sourceId={s.id} isActive={s.isActive} />
                  <DeleteKnowledgeButton sourceId={s.id} title={s.title} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
