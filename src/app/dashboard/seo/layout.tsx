import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import SidebarNav from '@/components/sidebar-nav'
import { LayoutDashboard, Hash, Lightbulb, FileText, Link2 } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard/seo', label: 'サマリー', exact: true, Icon: LayoutDashboard },
  { href: '/dashboard/seo/keywords', label: 'キーワード', Icon: Hash },
  { href: '/dashboard/seo/opportunities', label: '改善機会', Icon: Lightbulb },
  { href: '/dashboard/seo/articles', label: '記事ドラフト', Icon: FileText },
  { href: '/dashboard/seo/connect', label: 'GSC 設定', Icon: Link2 },
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
