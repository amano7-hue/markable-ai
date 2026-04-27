import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import { Users, Layers, Mail, Clock, Star, Sparkles, TrendingUp, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'ナーチャリング' }

export default async function NurturingPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const [leadCounts, segmentCount, pendingDraftCount, highScoreCount, connection, newLeadsThisWeek, generatedEmailsThisWeek, approvedEmailsThisWeek, lastLeadSync, icpCounts, unsegmentedHigh, prevWeekLeads, prevWeekGenerated, prevWeekApproved] = await Promise.all([
    prisma.nurtureLead.groupBy({
      by: ['lifecycle'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
    prisma.nurtureSegment.count({ where: { tenantId: ctx.tenant.id } }),
    prisma.nurtureEmailDraft.count({ where: { tenantId: ctx.tenant.id, status: 'PENDING' } }),
    prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, icpScore: { gte: 50 } } }),
    prisma.hubSpotConnection.findUnique({ where: { tenantId: ctx.tenant.id } }),
    prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, createdAt: { gte: weekAgo } } }),
    prisma.nurtureEmailDraft.count({ where: { tenantId: ctx.tenant.id, createdAt: { gte: weekAgo } } }),
    prisma.nurtureEmailDraft.count({ where: { tenantId: ctx.tenant.id, status: 'APPROVED', reviewedAt: { gte: weekAgo } } }),
    prisma.nurtureLead.findFirst({
      where: { tenantId: ctx.tenant.id },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true },
    }),
    Promise.all([
      prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, icpScore: { gte: 70 } } }),
      prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, icpScore: { gte: 40, lt: 70 } } }),
      prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, icpScore: { lt: 40 } } }),
    ]).then(([high, mid, low]) => ({ high, mid, low })),
    prisma.nurtureLead.count({
      where: { tenantId: ctx.tenant.id, icpScore: { gte: 50 }, segments: { none: {} } },
    }),
    prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.nurtureEmailDraft.count({ where: { tenantId: ctx.tenant.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.nurtureEmailDraft.count({ where: { tenantId: ctx.tenant.id, status: 'APPROVED', reviewedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
  ])

  const totalLeads = leadCounts.reduce((s, c) => s + c._count, 0)
  const mqlLeads = leadCounts.find((c) => c.lifecycle === 'marketingqualifiedlead')?._count ?? 0

  const hubspotStaleDays = lastLeadSync?.lastSyncedAt
    ? Math.floor((Date.now() - lastLeadSync.lastSyncedAt.getTime()) / 86_400_000)
    : null
  const hubspotStale = hubspotStaleDays !== null && hubspotStaleDays >= 3 && !!connection

  function weekDelta(current: number, previous: number) {
    if (previous === 0) return null
    return Math.round(((current - previous) / previous) * 100)
  }

  const stats = [
    {
      label: 'リード総数',
      value: totalLeads,
      href: '/dashboard/nurturing/leads',
      Icon: Users,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      sub: newLeadsThisWeek > 0 ? `今週 +${newLeadsThisWeek} 件` : null,
      subColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'MQL',
      value: mqlLeads,
      href: '/dashboard/nurturing/leads?lifecycle=marketingqualifiedlead',
      Icon: Star,
      iconBg: mqlLeads > 0 ? 'bg-blue-50 dark:bg-blue-950' : 'bg-muted',
      iconColor: mqlLeads > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
      sub: mqlLeads > 0 ? '商談化候補' : null,
      subColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'ICP スコア 50+',
      value: highScoreCount,
      href: '/dashboard/nurturing/leads',
      Icon: TrendingUp,
      iconBg: highScoreCount > 0 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-muted',
      iconColor: highScoreCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
      sub: highScoreCount > 0 ? '優先アプローチ対象' : null,
      subColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'セグメント数',
      value: segmentCount,
      href: '/dashboard/nurturing/segments',
      Icon: Layers,
      iconBg: 'bg-violet-50 dark:bg-violet-950',
      iconColor: 'text-violet-600 dark:text-violet-400',
      sub: null,
      subColor: '',
    },
    {
      label: 'AI メール (承認待ち)',
      value: pendingDraftCount,
      href: '/dashboard/nurturing/emails',
      Icon: pendingDraftCount > 0 ? Sparkles : Mail,
      iconBg: pendingDraftCount > 0 ? 'bg-primary/10' : 'bg-muted',
      iconColor: pendingDraftCount > 0 ? 'text-primary' : 'text-muted-foreground',
      sub: pendingDraftCount > 0 ? 'レビューしてください' : null,
      subColor: 'text-primary',
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">ナーチャリング ダッシュボード</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {lastLeadSync?.lastSyncedAt && (
            <span className={cn(
              'text-xs',
              hubspotStale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
            )}>
              最終 HubSpot 同期: {lastLeadSync.lastSyncedAt.toLocaleDateString('ja-JP')}
              {hubspotStale ? ` — ${hubspotStaleDays}日前` : ' (自動)'}
            </span>
          )}
          {generatedEmailsThisWeek > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              今週 {generatedEmailsThisWeek} 件生成
            </span>
          )}
          {approvedEmailsThisWeek > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              今週 {approvedEmailsThisWeek} 件承認
            </span>
          )}
          {!connection && (
            <Link
              href="/dashboard/nurturing/connect"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              HubSpot を接続
            </Link>
          )}
        </div>
      </div>

      {!connection && (
        <div className="mb-6 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          HubSpot が未接続のためモックデータを表示しています。
          <Link href="/dashboard/nurturing/connect" className="ml-1 font-medium underline underline-offset-2">
            HubSpot 設定
          </Link>
          から接続してください。
        </div>
      )}

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

      {/* ICP スコア分布 */}
      {totalLeads > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            ICP スコア分布
          </h2>
          <Link href="/dashboard/nurturing/leads" className="block">
            <Card className="transition-colors hover:border-primary/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  {/* スタックバー */}
                  <div className="flex h-3 flex-1 overflow-hidden rounded-full">
                    {icpCounts.high > 0 && (
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${(icpCounts.high / totalLeads) * 100}%` }}
                        title={`ハイ (70+): ${icpCounts.high} 件`}
                      />
                    )}
                    {icpCounts.mid > 0 && (
                      <div
                        className="bg-amber-400"
                        style={{ width: `${(icpCounts.mid / totalLeads) * 100}%` }}
                        title={`ミドル (40–69): ${icpCounts.mid} 件`}
                      />
                    )}
                    {icpCounts.low > 0 && (
                      <div
                        className="bg-muted-foreground/20"
                        style={{ width: `${(icpCounts.low / totalLeads) * 100}%` }}
                        title={`ロー (<40): ${icpCounts.low} 件`}
                      />
                    )}
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    ハイ (70+): {icpCounts.high}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                    ミドル (40–69): {icpCounts.mid}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
                    ロー (&lt;40): {icpCounts.low}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
          {unsegmentedHigh > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-foreground">
                  ICP スコア 50+ のリード {unsegmentedHigh} 件がセグメント未割り当てです
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  セグメントを作成してナーチャリングメールを配信できます
                </p>
              </div>
              <Link
                href="/dashboard/nurturing/segments/new"
                className="ml-4 shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                セグメント作成
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 今週の活動サマリー */}
      {(newLeadsThisWeek > 0 || generatedEmailsThisWeek > 0 || approvedEmailsThisWeek > 0) && (
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            今週の活動
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: '新規リード',
                value: newLeadsThisWeek,
                delta: weekDelta(newLeadsThisWeek, prevWeekLeads),
                Icon: UserPlus,
                href: '/dashboard/nurturing/leads',
                color: 'text-emerald-600 dark:text-emerald-400',
              },
              {
                label: 'AI メール生成',
                value: generatedEmailsThisWeek,
                delta: weekDelta(generatedEmailsThisWeek, prevWeekGenerated),
                Icon: Sparkles,
                href: '/dashboard/nurturing/emails',
                color: 'text-primary',
              },
              {
                label: 'メール承認',
                value: approvedEmailsThisWeek,
                delta: weekDelta(approvedEmailsThisWeek, prevWeekApproved),
                Icon: Mail,
                href: '/dashboard/nurturing/emails?status=APPROVED',
                color: approvedEmailsThisWeek > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
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
    </div>
  )
}
