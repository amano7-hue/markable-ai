import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import SidebarNav from '@/components/sidebar-nav'
const NAV_ITEMS = [
  { href: '/dashboard/analytics', label: 'サマリー', exact: true, icon: 'BarChart2' },
  { href: '/dashboard/analytics/connect', label: 'GA4 設定', icon: 'Link2' },
]

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="Analytics" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
