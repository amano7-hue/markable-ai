import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import DashboardHeader from '@/components/dashboard-header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  // MEMBER はプロジェクトメンバーシップのあるプロジェクトのみ表示
  // OWNER / ADMIN はテナント全プロジェクトにアクセス可
  const isAdminOrOwner = ctx.user.role === 'OWNER' || ctx.user.role === 'ADMIN'

  const [projects, editorMemberships] = await Promise.all([
    prisma.project.findMany({
      where: isAdminOrOwner
        ? { tenantId: ctx.tenant.id }
        : { tenantId: ctx.tenant.id, members: { some: { userId: ctx.user.id } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, slug: true, ownDomain: true, isDefault: true },
    }),
    !isAdminOrOwner
      ? prisma.projectMember.findMany({
          where: { userId: ctx.user.id, role: 'EDITOR' },
          select: { projectId: true },
        })
      : Promise.resolve([]),
  ])

  const canManageProjects = isAdminOrOwner || editorMemberships.length > 0
  const defaultProject = projects.find((p) => p.isDefault) ?? projects[0]
  const pid = defaultProject?.id ?? ''

  const [pendingCount, pendingByModule, llmoHealth, seoHealth, nurtureHealth] = await Promise.all([
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, status: 'PENDING' },
    }),
    prisma.approvalItem.groupBy({
      by: ['module'],
      where: { tenantId: ctx.tenant.id, status: 'PENDING' },
      _count: true,
    }),
    // LLMO health: cited / total active prompts
    Promise.all([
      prisma.aeoRankSnapshot.groupBy({
        by: ['promptId'],
        where: { tenantId: ctx.tenant.id, ownRank: { not: null } },
      }).then((r) => r.length),
      prisma.aeoPrompt.count({ where: { tenantId: ctx.tenant.id, isActive: true } }),
    ]).then(([cited, total]) => {
      if (total === 0) return 'warn' as const
      const rate = cited / total
      return rate >= 0.5 ? 'good' as const : rate >= 0.2 ? 'warn' as const : 'bad' as const
    }),
    // SEO health: has active keywords
    prisma.seoKeyword.count({ where: { tenantId: ctx.tenant.id, isActive: true } })
      .then((kwCount) => kwCount === 0 ? 'warn' as const : 'good' as const),
    // Nurturing health
    Promise.all([
      prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id } }),
      prisma.nurtureSegment.count({ where: { tenantId: ctx.tenant.id } }),
    ]).then(([leads, segs]) =>
      leads === 0 ? 'bad' as const : segs === 0 ? 'warn' as const : 'good' as const
    ),
  ])

  const pendingMap = Object.fromEntries(pendingByModule.map((r) => [r.module, r._count]))

  const navItems = [
    { href: '/dashboard', label: 'ホーム', exact: true },
    { href: '/dashboard/projects', label: 'プロジェクト' },
    {
      href: pid ? `/dashboard/p/${pid}/llmo` : '/dashboard/llmo',
      label: 'LLMO',
      badge: pendingMap['aeo'] ?? 0,
      health: llmoHealth,
    },
    {
      href: pid ? `/dashboard/p/${pid}/seo` : '/dashboard/seo',
      label: 'SEO',
      badge: 0,
      health: seoHealth,
    },
    {
      href: pid ? `/dashboard/p/${pid}/nurturing` : '/dashboard/nurturing',
      label: 'ナーチャリング',
      badge: pendingMap['nurturing'] ?? 0,
      health: nurtureHealth,
    },
    ...(pid ? [{ href: `/dashboard/p/${pid}/analytics`, label: 'アナリティクス' }] : [{ href: '/dashboard/analytics', label: 'アナリティクス' }]),
    ...(pid ? [{ href: `/dashboard/p/${pid}/settings`, label: '設定' }] : [{ href: '/dashboard/settings', label: '設定' }]),
    ...(pid ? [{ href: `/dashboard/p/${pid}/settings/members`, label: 'メンバー' }] : []),
  ]

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        navItems={navItems}
        pendingCount={pendingCount}
        projects={projects}
        currentProjectId={pid}
        canManageProjects={canManageProjects}
      />
      {children}
    </div>
  )
}
