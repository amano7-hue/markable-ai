import type { Metadata } from 'next'
import Link from 'next/link'
import { getAuth } from '@/lib/auth/get-auth'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { listPrompts, detectCitationGaps } from '@/modules/aeo'
import { prisma } from '@/lib/db/client'
import { MessageSquare, AlertCircle, Percent, Clock, Sparkles, TrendingUp, TrendingDown, Bot, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { AeoEngine } from '@/generated/prisma'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'AEO' }

export default async function AeoPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const [prompts, gaps, pendingApprovals, generatedThisWeek, approvedThisWeek, lastSnapshot, thisWeekCited, lastWeekCited, prevWeekGenerated, prevWeekApproved] = await Promise.all([
    listPrompts(ctx.tenant.id),
    detectCitationGaps(ctx.tenant.id, ctx.tenant.ownDomain),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', status: 'PENDING' },
    }),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', createdAt: { gte: weekAgo } },
    }),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', status: 'APPROVED', reviewedAt: { gte: weekAgo } },
    }),
    prisma.aeoRankSnapshot.findFirst({
      where: { tenantId: ctx.tenant.id },
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    }),
    // 今週引用されたプロンプト数（重複排除）
    prisma.aeoRankSnapshot.groupBy({
      by: ['promptId'],
      where: { tenantId: ctx.tenant.id, snapshotDate: { gte: weekAgo }, ownRank: { not: null } },
    }).then((r) => r.length),
    // 先週引用されたプロンプト数
    prisma.aeoRankSnapshot.groupBy({
      by: ['promptId'],
      where: { tenantId: ctx.tenant.id, snapshotDate: { gte: twoWeeksAgo, lt: weekAgo }, ownRank: { not: null } },
    }).then((r) => r.length),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
    }),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', status: 'APPROVED', reviewedAt: { gte: twoWeeksAgo, lt: weekAgo } },
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

  const citationTrend =
    lastWeekCited > 0
      ? Math.round(((thisWeekCited - lastWeekCited) / lastWeekCited) * 100)
      : null

  function weekDelta(current: number, previous: number) {
    if (previous === 0) return null
    return Math.round(((current - previous) / previous) * 100)
  }

  // エンジン別引用率
  const ENGINES: AeoEngine[] = ['CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW']
  const ENGINE_LABELS: Record<AeoEngine, string> = {
    CHATGPT: 'ChatGPT',
    PERPLEXITY: 'Perplexity',
    GEMINI: 'Gemini',
    GOOGLE_AI_OVERVIEW: 'Google AIO',
  }
  const engineStats = ENGINES.map((engine) => {
    const withData = activePromptList.filter((p) => engine in p.citationsByEngine)
    const cited = withData.filter((p) => p.citationsByEngine[engine] !== null).length
    const rate = withData.length > 0 ? Math.round((cited / withData.length) * 100) : null
    return { engine, label: ENGINE_LABELS[engine], cited, total: withData.length, rate }
  }).filter((e) => e.total > 0)

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
      trend: citationTrend,
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AEO ダッシュボード</h1>
          {lastSnapshot && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              最終同期: {lastSnapshot.snapshotDate.toLocaleDateString('ja-JP')} (自動)
            </p>
          )}
        </div>
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
                {(() => {
                  const t = 'trend' in stat ? stat.trend : undefined
                  if (t == null) return null
                  return (
                    <p className={cn(
                      'mt-0.5 text-xs font-medium',
                      t >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                    )}>
                      {t >= 0 ? `+${t}%` : `${t}%`} 先週比
                    </p>
                  )
                })()}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 今週の活動サマリー */}
      {(generatedThisWeek > 0 || approvedThisWeek > 0 || gaps.length > 0) && (
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            今週の活動
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'AI 改善提案生成',
                value: generatedThisWeek,
                delta: weekDelta(generatedThisWeek, prevWeekGenerated),
                Icon: Sparkles,
                href: '/dashboard/aeo/suggestions',
                color: 'text-primary',
              },
              {
                label: '提案承認',
                value: approvedThisWeek,
                delta: weekDelta(approvedThisWeek, prevWeekApproved),
                Icon: CheckCircle2,
                href: '/dashboard/aeo/suggestions?status=APPROVED',
                color: approvedThisWeek > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
              },
              {
                label: '引用ギャップ',
                value: gaps.length,
                delta: null,
                Icon: ShieldAlert,
                href: '/dashboard/aeo/gaps',
                color: gaps.length > 0 ? 'text-destructive' : 'text-muted-foreground',
              },
              {
                label: '引用済みプロンプト',
                value: citedCount,
                delta: citationTrend,
                Icon: citedCount > 0 ? TrendingUp : TrendingDown,
                href: '/dashboard/aeo/prompts',
                color: citedCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
              },
            ].map((item) => (
              <Link key={item.label} href={item.href}>
                <Card className="transition-colors hover:border-primary/30">
                  <CardContent className="pt-4 pb-3">
                    <item.Icon className={cn('mb-2 h-4 w-4', item.color)} />
                    <p className={cn('text-2xl font-bold tabular-nums', item.color)}>{item.value}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
                    {item.delta !== null && (
                      <p className={cn(
                        'mt-0.5 text-xs font-medium',
                        item.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                      )}>
                        {item.delta >= 0 ? `+${item.delta}%` : `${item.delta}%`} 先週比
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* エンジン別引用率 */}
      {engineStats.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI 検索エンジン別 引用率
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {engineStats.map((e) => {
              const good = e.rate !== null && e.rate >= 50
              const warn = e.rate !== null && e.rate >= 20 && e.rate < 50
              return (
                <Card key={e.engine}>
                  <CardContent className="pt-4 pb-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">{e.label}</p>
                      <Bot className={cn(
                        'h-3.5 w-3.5',
                        good ? 'text-emerald-500' : warn ? 'text-amber-500' : 'text-destructive',
                      )} />
                    </div>
                    <p className={cn(
                      'text-2xl font-bold tabular-nums',
                      good ? 'text-emerald-600 dark:text-emerald-400'
                        : warn ? 'text-amber-600 dark:text-amber-400'
                        : 'text-destructive',
                    )}>
                      {e.rate !== null ? `${e.rate}%` : '-'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {e.cited}/{e.total} プロンプト引用
                    </p>
                    {/* 引用率バー */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          good ? 'bg-emerald-500' : warn ? 'bg-amber-500' : 'bg-destructive',
                        )}
                        style={{ width: `${e.rate ?? 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
