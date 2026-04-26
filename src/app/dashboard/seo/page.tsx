import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent } from '@/components/ui/card'
import { listKeywords, getTopOpportunities } from '@/modules/seo'
import { prisma } from '@/lib/db/client'
import { Hash, TrendingUp, TrendingDown, MousePointerClick, Lightbulb, Clock, Sparkles, FileText, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'SEO' }

export default async function SeoPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [{ keywords }, opportunities, pendingCount, approvedThisWeek, generatedThisWeek, top10Count, lastGscSync] = await Promise.all([
    listKeywords(ctx.tenant.id),
    getTopOpportunities(ctx.tenant.id),
    prisma.seoArticle.count({ where: { tenantId: ctx.tenant.id, status: 'PENDING' } }),
    prisma.seoArticle.count({ where: { tenantId: ctx.tenant.id, status: 'APPROVED', reviewedAt: { gte: weekAgo } } }),
    prisma.seoArticle.count({ where: { tenantId: ctx.tenant.id, createdAt: { gte: weekAgo } } }),
    // latestPosition は計算フィールドのため、snapshots から直接集計
    prisma.seoKeywordSnapshot.groupBy({
      by: ['keywordId'],
      where: { tenantId: ctx.tenant.id, position: { lte: 10 } },
    }).then((rows) => rows.length),
    prisma.seoKeywordSnapshot.findFirst({
      where: { tenantId: ctx.tenant.id },
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    }),
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

  // ランキング変動（直近スナップショットと1つ前の比較）
  const movers = keywords
    .filter((k) => k.isActive && k.latestPosition !== null && k.previousPosition !== null)
    .map((k) => ({
      id: k.id,
      text: k.text,
      current: k.latestPosition!,
      delta: k.previousPosition! - k.latestPosition!, // positive = improved
    }))
    .filter((k) => Math.abs(k.delta) >= 0.5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const improved = movers.filter((k) => k.delta > 0).slice(0, 3)
  const declined = movers.filter((k) => k.delta < 0).slice(0, 3)

  const stats = [
    {
      label: 'アクティブキーワード',
      value: activeKeywords,
      href: '/dashboard/seo/keywords',
      Icon: Hash,
      iconBg: 'bg-violet-50 dark:bg-violet-950',
      iconColor: 'text-violet-600 dark:text-violet-400',
      sub: top10Count > 0 ? `TOP10 ${top10Count}件` : null,
      subColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: '平均順位',
      value: avgPosition,
      href: '/dashboard/seo/keywords',
      Icon: goodPos ? TrendingUp : TrendingDown,
      iconBg: goodPos ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-amber-50 dark:bg-amber-950',
      iconColor: goodPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
      sub: avgPosNum !== null ? (goodPos ? 'TOP10圏内' : '改善余地あり') : null,
      subColor: goodPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
    },
    {
      label: '総クリック数',
      value: totalClicks.toLocaleString(),
      href: '/dashboard/seo/keywords',
      Icon: MousePointerClick,
      iconBg: 'bg-blue-50 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
      sub: null,
      subColor: '',
    },
    {
      label: '改善機会',
      value: opportunities.length,
      href: '/dashboard/seo/opportunities',
      Icon: Lightbulb,
      iconBg: opportunities.length > 0 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-muted',
      iconColor: opportunities.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
      sub: opportunities.length > 0 ? 'AI が特定済み' : null,
      subColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'AI 記事 (承認待ち)',
      value: pendingCount,
      href: '/dashboard/seo/articles',
      Icon: pendingCount > 0 ? Sparkles : FileText,
      iconBg: pendingCount > 0 ? 'bg-primary/10' : 'bg-muted',
      iconColor: pendingCount > 0 ? 'text-primary' : 'text-muted-foreground',
      sub: pendingCount > 0 ? 'レビューしてください' : null,
      subColor: 'text-primary',
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SEO ダッシュボード</h1>
          {lastGscSync && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              最終 GSC 同期: {lastGscSync.snapshotDate.toLocaleDateString('ja-JP')} (自動)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {generatedThisWeek > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              今週 {generatedThisWeek} 件生成
            </span>
          )}
          {approvedThisWeek > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              今週 {approvedThisWeek} 件承認
            </span>
          )}
        </div>
      </div>
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
                {stat.sub && (
                  <p className={cn('mt-0.5 text-xs font-medium', stat.subColor)}>{stat.sub}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ランキング変動 */}
      {(improved.length > 0 || declined.length > 0) && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {improved.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <ArrowUp className="h-3 w-3" />
                  順位上昇
                </p>
                <ul className="space-y-1.5">
                  {improved.map((k) => (
                    <li key={k.id}>
                      <Link
                        href={`/dashboard/seo/keywords/${k.id}`}
                        className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent"
                      >
                        <span className="truncate text-foreground">{k.text}</span>
                        <span className="ml-2 shrink-0 font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                          +{k.delta.toFixed(1)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {declined.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <ArrowDown className="h-3 w-3" />
                  順位下降
                </p>
                <ul className="space-y-1.5">
                  {declined.map((k) => (
                    <li key={k.id}>
                      <Link
                        href={`/dashboard/seo/keywords/${k.id}`}
                        className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent"
                      >
                        <span className="truncate text-foreground">{k.text}</span>
                        <span className="ml-2 shrink-0 font-medium tabular-nums text-destructive">
                          {k.delta.toFixed(1)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
