import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import SidebarNav from '@/components/sidebar-nav'

const NAV_ITEMS = [
  { href: '/dashboard/seo', label: 'サマリー', exact: true },
  { href: '/dashboard/seo/keywords', label: 'キーワード' },
  { href: '/dashboard/seo/opportunities', label: '改善機会' },
  { href: '/dashboard/seo/articles', label: '記事ドラフト' },
  { href: '/dashboard/seo/connect', label: 'GSC 設定' },
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
