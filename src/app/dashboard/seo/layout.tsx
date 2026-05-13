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
    { href: '/dashboard/seo/audit', label: 'テクニカル監査', icon: 'ShieldAlert' },
    { href: '/dashboard/seo/competitors', label: '競合差分分析', icon: 'Search' },
    { href: '/dashboard/seo/internal-links', label: '内部リンク提案', icon: 'Link2' },
    { href: '/dashboard/seo/brand', label: 'ブランド設定', icon: 'Palette' },
    { href: '/dashboard/seo/knowledge', label: 'ナレッジ', icon: 'BookOpen' },
    { href: '/dashboard/seo/cta-blocks', label: 'CTAブロック', icon: 'Megaphone' },
    { href: '/dashboard/seo/connect', label: 'GSC 設定', icon: 'Settings' },
  ]

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <SidebarNav title="SEO" items={NAV_ITEMS} />
      <main className="flex-1 min-w-0 overflow-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
    </div>
  )
}
