import type { Metadata } from 'next'
import Link from 'next/link'
import { getAuth } from '@/lib/auth/get-auth'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { listPrompts, detectCitationGaps } from '@/modules/aeo'
import { prisma } from '@/lib/db/client'
import { MessageSquare, AlertCircle, Percent, Clock, Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'AEO' }

export default async function AeoPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [prompts, gaps, pendingApprovals, generatedThisWeek] = await Promise.all([
    listPrompts(ctx.tenant.id),
    detectCitationGaps(ctx.tenant.id, ctx.tenant.ownDomain),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', status: 'PENDING' },
    }),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', createdAt: { gte: weekAgo } },
    }),
  ])

  const activePromptList = prompts.filter((p) => p.isActive)
  const activePrompts = activePromptList.length
  const citedCount = activePromptList.filter(
    (p) => Object.values(p.citationsByEngine).some((rank) => rank !== null),
  ).length
  const uncitedCount = activePrompts - citedCount
  const citationRate =
    activePrompts > 0 ? Math.round((citedCount / activePrompts) * 100) : 0

  const stats = [
    {
      label: 'アクティブプロンプト',
      value: activePrompts,
      href: '/dashboard/aeo/prompts',
      Icon: MessageSquare,
      iconBg: 'bg-blue-50 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
      sub: null,
    },
    {
      label: '自社引用率',
      value: `${citationRate}%`,
      href: '/dashboard/aeo/prompts',
      Icon: citationRate >= 50 ? TrendingUp : TrendingDown,
      iconBg: citationRate >= 50 ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-amber-50 dark:bg-amber-950',
      iconColor: citationRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
      sub: citationRate >= 50 ? '目標達成' : '改善が必要',
    },
    {
      label: '引用なしプロンプト',
      value: uncitedCount,
      href: '/dashboard/aeo/prompts',
      Icon: AlertCircle,
      iconBg: uncitedCount > 0 ? 'bg-rose-50 dark:bg-rose-950' : 'bg-emerald-50 dark:bg-emerald-950',
      iconColor: uncitedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
      sub: uncitedCount > 0 ? '要改善' : 'すべて引用済み',
    },
    {
      label: '引用ギャップ',
      value: gaps.length,
      href: '/dashboard/aeo/gaps',
      Icon: AlertCircle,
      iconBg: gaps.length > 0 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-muted',
      iconColor: gaps.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
      sub: gaps.length > 0 ? '競合が引用されている' : null,
    },
    {
      label: 'AI 改善提案 (承認待ち)',
      value: pendingApprovals,
      href: '/dashboard/aeo/suggestions',
      Icon: pendingApprovals > 0 ? Sparkles : Clock,
      iconBg: pendingApprovals > 0 ? 'bg-primary/10' : 'bg-muted',
      iconColor: pendingApprovals > 0 ? 'text-primary' : 'text-muted-foreground',
      sub: pendingApprovals > 0 ? 'レビューしてください' : null,
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">AEO ダッシュボード</h1>
        {generatedThisWeek > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            今週 {generatedThisWeek} 件 AI 生成
          </span>
        )}
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
                  <p className={cn('mt-0.5 text-xs font-medium', stat.iconColor)}>{stat.sub}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
