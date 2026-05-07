import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import SidebarNav from '@/components/sidebar-nav'
const NAV_ITEMS = [
  { href: '/dashboard/attribution', label: 'アトリビューション', exact: true, icon: 'GitMerge' },
]

export default async function AttributionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <SidebarNav title="Attribution" items={NAV_ITEMS} />
      <main className="flex-1 min-w-0 overflow-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
    </div>
  )
}
