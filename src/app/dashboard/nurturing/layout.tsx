import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import SidebarNav from '@/components/sidebar-nav'
import { LayoutDashboard, Users, Layers, Mail, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard/nurturing', label: 'サマリー', exact: true, Icon: LayoutDashboard },
  { href: '/dashboard/nurturing/leads', label: 'リード', Icon: Users },
  { href: '/dashboard/nurturing/segments', label: 'セグメント', Icon: Layers },
  { href: '/dashboard/nurturing/emails', label: 'メールドラフト', Icon: Mail },
  { href: '/dashboard/nurturing/connect', label: 'HubSpot 設定', Icon: Settings },
]

export default async function NurturingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="Nurturing" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
