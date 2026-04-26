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

  const [leadCounts, segmentCount, pendingDraftCount, highScoreCount, connection, newLeadsThisWeek, generatedEmailsThisWeek, approvedEmailsThisWeek] = await Promise.all([
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
  ])

  const totalLeads = leadCounts.reduce((s, c) => s + c._count, 0)
  const mqlLeads = leadCounts.find((c) => c.lifecycle === 'marketingqualifiedlead')?._count ?? 0

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
        <div className="flex items-center gap-2">
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
    </div>
  )
}
