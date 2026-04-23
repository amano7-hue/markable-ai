import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import SidebarNav from '@/components/sidebar-nav'

const NAV_ITEMS = [
  { href: '/dashboard/aeo', label: 'サマリー', exact: true },
  { href: '/dashboard/aeo/prompts', label: 'プロンプト' },
  { href: '/dashboard/aeo/gaps', label: '引用ギャップ' },
  { href: '/dashboard/aeo/suggestions', label: '改善提案' },
]

export default async function AeoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="AEO" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
