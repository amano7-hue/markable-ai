import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listKeywords, getTopOpportunities, listArticles } from '@/modules/seo'

export default async function SeoPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [keywords, opportunities, pendingArticles] = await Promise.all([
    listKeywords(ctx.tenant.id),
    getTopOpportunities(ctx.tenant.id),
    listArticles(ctx.tenant.id, 'PENDING'),
  ])

  const activeKeywords = keywords.filter((k) => k.isActive).length
  const positions = keywords
    .map((k) => k.latestPosition)
    .filter((p): p is number => p !== null)
  const avgPosition =
    positions.length > 0
      ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
      : '-'
  const totalClicks = keywords
    .reduce((sum, k) => sum + (k.latestClicks ?? 0), 0)

  const stats = [
    { label: 'アクティブキーワード', value: activeKeywords, href: '/dashboard/seo/keywords' },
    { label: '平均順位', value: avgPosition, href: '/dashboard/seo/keywords' },
    { label: '総クリック数', value: totalClicks.toLocaleString(), href: '/dashboard/seo/keywords' },
    { label: '改善機会', value: opportunities.length, href: '/dashboard/seo/opportunities' },
    { label: '記事承認待ち', value: pendingArticles.length, href: '/dashboard/seo/articles' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">SEO ダッシュボード</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:bg-accent/50 transition-colors">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
