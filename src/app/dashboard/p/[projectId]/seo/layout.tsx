import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import SidebarNav from '@/components/sidebar-nav'

export default async function SeoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const base = `/dashboard/p/${projectId}/seo`

  const [pendingArticles, opportunityCount] = await Promise.all([
    prisma.seoArticle.count({
      where: { tenantId: ctx.tenant.id, projectId, status: 'PENDING' },
    }),
    prisma.seoKeywordSnapshot.groupBy({
      by: ['keywordId'],
      where: { tenantId: ctx.tenant.id, projectId, position: { gte: 11, lte: 30 } },
    }).then((r) => r.length),
  ])

  const NAV_ITEMS = [
    { href: base, label: 'サマリー', exact: true, icon: 'LayoutDashboard' },
    { href: `${base}/keywords`, label: 'キーワード', icon: 'Hash' },
    {
      href: `${base}/opportunities`,
      label: '改善機会',
      icon: 'Lightbulb',
      badge: opportunityCount > 0 ? opportunityCount : undefined,
    },
    {
      href: `${base}/articles`,
      label: '記事ドラフト',
      icon: 'FileText',
      badge: pendingArticles > 0 ? pendingArticles : undefined,
    },
    { href: `${base}/audit`, label: 'テクニカル監査', icon: 'ShieldAlert' },
    { href: `${base}/competitors`, label: '競合差分分析', icon: 'Search' },
    { href: `${base}/internal-links`, label: '内部リンク提案', icon: 'Link2' },
    { href: `${base}/brand`, label: 'ブランド設定', icon: 'Palette' },
    { href: `${base}/knowledge`, label: 'ナレッジ', icon: 'BookOpen' },
    { href: `${base}/connect`, label: 'GSC 設定', icon: 'Settings' },
  ]

  return (
    <div className="flex min-h-screen">
      <SidebarNav title="SEO" items={NAV_ITEMS} />
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
