import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import SidebarNav from '@/components/sidebar-nav'

export default async function ProjectNurturingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const base = `/dashboard/p/${projectId}/nurturing`

  const [pendingEmails, highScoreLeads] = await Promise.all([
    prisma.nurtureEmailDraft.count({
      where: { tenantId: ctx.tenant.id, projectId, status: 'PENDING' },
    }),
    prisma.nurtureLead.count({
      where: {
        tenantId: ctx.tenant.id,
        projectId,
        icpScore: { gte: 50 },
        segments: { none: {} },
      },
    }),
  ])

  const NAV_ITEMS = [
    { href: base, label: 'サマリー', exact: true, icon: 'LayoutDashboard' },
    {
      href: `${base}/leads`,
      label: 'リード',
      icon: 'Users',
      badge: highScoreLeads > 0 ? highScoreLeads : undefined,
    },
    { href: `${base}/segments`, label: 'セグメント', icon: 'Layers' },
    {
      href: `${base}/emails`,
      label: 'メールドラフト',
      icon: 'Mail',
      badge: pendingEmails > 0 ? pendingEmails : undefined,
    },
    { href: `${base}/timing`, label: '配信タイミング', icon: 'Clock' },
    { href: `${base}/connect`, label: 'HubSpot 設定', icon: 'Settings' },
  ]

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <SidebarNav title="Nurturing" items={NAV_ITEMS} />
      <main className="flex-1 min-w-0 overflow-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
    </div>
  )
}
