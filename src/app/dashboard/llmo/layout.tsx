import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import SidebarNav from '@/components/sidebar-nav'

export default async function LlmoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [pendingSuggestions, uncitedSnapshots] = await Promise.all([
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', status: 'PENDING' },
    }),
    // prompts that have at least one recent snapshot where we're not cited
    prisma.aeoRankSnapshot.groupBy({
      by: ['promptId'],
      where: { tenantId: ctx.tenant.id, ownRank: null },
    }).then((r) => r.length),
  ])

  const NAV_ITEMS = [
    { href: '/dashboard/llmo', label: 'サマリー', exact: true, icon: 'LayoutDashboard' },
    { href: '/dashboard/llmo/prompts', label: 'プロンプト', icon: 'MessageSquare' },
    {
      href: '/dashboard/llmo/gaps',
      label: '引用ギャップ',
      icon: 'AlertCircle',
      badge: uncitedSnapshots > 0 ? uncitedSnapshots : undefined,
    },
    {
      href: '/dashboard/llmo/suggestions',
      label: '改善提案',
      icon: 'Lightbulb',
      badge: pendingSuggestions > 0 ? pendingSuggestions : undefined,
    },
    { href: '/dashboard/llmo/share-of-voice', label: 'Share of Voice', icon: 'BarChart2' },
  ]

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="LLMO" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
