import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import SidebarNav from '@/components/sidebar-nav'
const NAV_ITEMS = [
  { href: '/dashboard/seo', label: 'サマリー', exact: true, icon: 'LayoutDashboard' },
  { href: '/dashboard/seo/keywords', label: 'キーワード', icon: 'Hash' },
  { href: '/dashboard/seo/opportunities', label: '改善機会', icon: 'Lightbulb' },
  { href: '/dashboard/seo/articles', label: '記事ドラフト', icon: 'FileText' },
  { href: '/dashboard/seo/connect', label: 'GSC 設定', icon: 'Link2' },
]

export default async function SeoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="SEO" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
