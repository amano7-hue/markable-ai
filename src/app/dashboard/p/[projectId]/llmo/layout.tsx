import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import SidebarNav from '@/components/sidebar-nav'

export default async function LlmoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const base = `/dashboard/p/${projectId}/llmo`

  const [pendingSuggestions, uncitedSnapshots] = await Promise.all([
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, projectId, module: 'aeo', status: 'PENDING' },
    }),
    prisma.aeoRankSnapshot.groupBy({
      by: ['promptId'],
      where: { tenantId: ctx.tenant.id, projectId, ownRank: null },
    }).then((r) => r.length),
  ])

  const NAV_ITEMS = [
    { href: base, label: 'サマリー', exact: true, icon: 'LayoutDashboard' },
    { href: `${base}/prompts`, label: 'プロンプト', icon: 'MessageSquare' },
    {
      href: `${base}/gaps`,
      label: '引用ギャップ',
      icon: 'AlertCircle',
      badge: uncitedSnapshots > 0 ? uncitedSnapshots : undefined,
    },
    {
      href: `${base}/suggestions`,
      label: '改善提案',
      icon: 'Lightbulb',
      badge: pendingSuggestions > 0 ? pendingSuggestions : undefined,
    },
    { href: `${base}/share-of-voice`, label: 'Share of Voice', icon: 'BarChart2' },
  ]

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="LLMO" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
