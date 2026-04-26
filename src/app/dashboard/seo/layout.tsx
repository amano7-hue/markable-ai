import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import SidebarNav from '@/components/sidebar-nav'

export default async function SeoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [pendingArticles, opportunityCount] = await Promise.all([
    prisma.seoArticle.count({
      where: { tenantId: ctx.tenant.id, status: 'PENDING' },
    }),
    // keywords in position 11-30 (improvement opportunity zone)
    prisma.seoKeywordSnapshot.groupBy({
      by: ['keywordId'],
      where: { tenantId: ctx.tenant.id, position: { gte: 11, lte: 30 } },
    }).then((r) => r.length),
  ])

  const NAV_ITEMS = [
    { href: '/dashboard/seo', label: 'サマリー', exact: true, icon: 'LayoutDashboard' },
    { href: '/dashboard/seo/keywords', label: 'キーワード', icon: 'Hash' },
    {
      href: '/dashboard/seo/opportunities',
      label: '改善機会',
      icon: 'Lightbulb',
      badge: opportunityCount > 0 ? opportunityCount : undefined,
    },
    {
      href: '/dashboard/seo/articles',
      label: '記事ドラフト',
      icon: 'FileText',
      badge: pendingArticles > 0 ? pendingArticles : undefined,
    },
    { href: '/dashboard/seo/connect', label: 'GSC 設定', icon: 'Link2' },
  ]

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="SEO" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
