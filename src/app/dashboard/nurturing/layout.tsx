import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import SidebarNav from '@/components/sidebar-nav'

export default async function NurturingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [pendingEmails, highScoreLeads] = await Promise.all([
    prisma.nurtureEmailDraft.count({
      where: { tenantId: ctx.tenant.id, status: 'PENDING' },
    }),
    // leads with high ICP scores that haven't been segmented yet
    prisma.nurtureLead.count({
      where: {
        tenantId: ctx.tenant.id,
        icpScore: { gte: 50 },
        segments: { none: {} },
      },
    }),
  ])

  const NAV_ITEMS = [
    { href: '/dashboard/nurturing', label: 'サマリー', exact: true, icon: 'LayoutDashboard' },
    {
      href: '/dashboard/nurturing/leads',
      label: 'リード',
      icon: 'Users',
      badge: highScoreLeads > 0 ? highScoreLeads : undefined,
    },
    { href: '/dashboard/nurturing/segments', label: 'セグメント', icon: 'Layers' },
    {
      href: '/dashboard/nurturing/emails',
      label: 'メールドラフト',
      icon: 'Mail',
      badge: pendingEmails > 0 ? pendingEmails : undefined,
    },
    { href: '/dashboard/nurturing/connect', label: 'HubSpot 設定', icon: 'Settings' },
  ]

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="Nurturing" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
