import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { Users, Globe, Database, Settings2, Filter, PenLine } from 'lucide-react'

export const metadata: Metadata = { title: 'プロジェクト設定' }

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const { project } = ctx

  const [memberCount, hasGsc, channelFilter, writingProfile] = await Promise.all([
    prisma.projectMember.count({ where: { projectId } }),
    prisma.gscConnection.findFirst({ where: { projectId }, select: { id: true } }).then(Boolean),
    prisma.project.findFirst({ where: { id: projectId, tenantId: ctx.tenant.id }, select: { ga4ChannelFilter: true } })
      .then((p) => (p?.ga4ChannelFilter as string[] | undefined) ?? []),
    prisma.brandProfile.findFirst({
      where: { projectId },
      select: { decorationRules: true, lineBreakRules: true },
    }),
  ])

  const base = `/dashboard/p/${projectId}`

  const sections = [
    {
      href: `${base}/settings/members`,
      icon: Users,
      label: 'メンバー管理',
      description: 'プロジェクトへのアクセス権限を管理します',
      meta: `${memberCount} 名`,
    },
    {
      href: `${base}/seo/connect`,
      icon: Database,
      label: 'GSC 連携',
      description: 'Google Search Console からキーワードデータを同期します',
      meta: hasGsc ? '接続済み' : '未接続',
      metaColor: hasGsc ? 'text-emerald-600' : 'text-amber-600',
    },
    {
      href: `${base}/settings/writing`,
      icon: PenLine,
      label: 'ライティングルール',
      description: '装飾・改行のルールをプロジェクトごとに設定します',
      meta: [writingProfile?.decorationRules ? '装飾' : '', writingProfile?.lineBreakRules ? '改行' : ''].filter(Boolean).join(' / ') || '未設定',
      metaColor: (writingProfile?.decorationRules || writingProfile?.lineBreakRules) ? 'text-primary' : 'text-muted-foreground',
    },
    {
      href: `${base}/settings/ga4`,
      icon: Filter,
      label: 'GA4 チャンネルフィルター',
      description: 'セッション集計に含めるチャンネルグループを選択します',
      meta: channelFilter.length > 0 ? `${channelFilter.length} チャンネル` : '全チャンネル',
      metaColor: channelFilter.length > 0 ? 'text-primary' : 'text-muted-foreground',
    },
    {
      href: `/dashboard/settings`,
      icon: Settings2,
      label: 'テナント設定',
      description: 'GA4・HubSpot など全テナント共通の設定を管理します',
      meta: null,
    },
  ]

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-lg font-semibold">プロジェクト設定</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {project.name}
          {project.ownDomain && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-muted-foreground">
              <Globe className="h-3 w-3" />
              {project.ownDomain}
            </span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3.5 hover:bg-accent transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
            </div>
            {s.meta && (
              <span className={`shrink-0 text-xs font-medium ${s.metaColor ?? 'text-muted-foreground'}`}>
                {s.meta}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
