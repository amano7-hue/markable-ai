import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent } from '@/components/ui/card'
import { listKeywords, getTopOpportunities } from '@/modules/seo'
import { prisma } from '@/lib/db/client'
import { Hash, TrendingUp, MousePointerClick, Lightbulb, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'SEO' }

export default async function SeoPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [{ keywords }, opportunities, pendingCount] = await Promise.all([
    listKeywords(ctx.tenant.id),
    getTopOpportunities(ctx.tenant.id),
    prisma.seoArticle.count({ where: { tenantId: ctx.tenant.id, status: 'PENDING' } }),
  ])

  const activeKeywords = keywords.filter((k) => k.isActive).length
  const positions = keywords
    .map((k) => k.latestPosition)
    .filter((p): p is number => p !== null)
  const avgPosition =
    positions.length > 0
      ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
      : '-'
  const totalClicks = keywords.reduce((sum, k) => sum + (k.latestClicks ?? 0), 0)

  const avgPosNum = avgPosition === '-' ? null : parseFloat(avgPosition)
  const goodPos = avgPosNum !== null && avgPosNum <= 10

  const stats = [
    {
      label: 'アクティブキーワード',
      value: activeKeywords,
      href: '/dashboard/seo/keywords',
      Icon: Hash,
      iconBg: 'bg-violet-50 dark:bg-violet-950',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: '平均順位',
      value: avgPosition,
      href: '/dashboard/seo/keywords',
      Icon: TrendingUp,
      iconBg: goodPos ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-amber-50 dark:bg-amber-950',
      iconColor: goodPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
    },
    {
      label: '総クリック数',
      value: totalClicks.toLocaleString(),
      href: '/dashboard/seo/keywords',
      Icon: MousePointerClick,
      iconBg: 'bg-blue-50 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: '改善機会',
      value: opportunities.length,
      href: '/dashboard/seo/opportunities',
      Icon: Lightbulb,
      iconBg: opportunities.length > 0 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-muted',
      iconColor: opportunities.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
    },
    {
      label: '記事承認待ち',
      value: pendingCount,
      href: '/dashboard/seo/articles',
      Icon: Clock,
      iconBg: pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-muted',
      iconColor: pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
    },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">SEO ダッシュボード</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group">
            <Card className="transition-all hover:shadow-md hover:border-primary/30">
              <CardContent className="pt-5 pb-4">
                <div className={cn('mb-3 inline-flex rounded-lg p-2', stat.iconBg)}>
                  <stat.Icon className={cn('h-4 w-4', stat.iconColor)} />
                </div>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
