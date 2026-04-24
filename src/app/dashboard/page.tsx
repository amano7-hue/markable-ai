import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import SetupChecklist from './setup-checklist'
import { listPrompts, detectCitationGaps } from '@/modules/aeo'
import { getTopOpportunities } from '@/modules/seo'
import { getMetricsSummary } from '@/modules/analytics'
import { getAttributionFunnel } from '@/modules/attribution'
import { prisma } from '@/lib/db/client'
import {
  Bot,
  TrendingUp,
  Users,
  BarChart2,
  GitMerge,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'ダッシュボード' }

const MODULE_CONFIG = {
  AEO: {
    Icon: Bot,
    iconBg: 'bg-blue-50 dark:bg-blue-950',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  SEO: {
    Icon: TrendingUp,
    iconBg: 'bg-violet-50 dark:bg-violet-950',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  ナーチャリング: {
    Icon: Users,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  アナリティクス: {
    Icon: BarChart2,
    iconBg: 'bg-amber-50 dark:bg-amber-950',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  アトリビューション: {
    Icon: GitMerge,
    iconBg: 'bg-rose-50 dark:bg-rose-950',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
} as const

export default async function DashboardPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { user, tenant } = ctx

  const [
    aeoPrompts,
    aeoGaps,
    aeoPending,
    activeKeywordCount,
    seoOpportunities,
    seoPending,
    nurtureLeadCount,
    nurtureSegmentCount,
    nurturePendingCount,
    analyticsSummary,
    attributionFunnel,
  ] = await Promise.all([
    listPrompts(tenant.id),
    detectCitationGaps(tenant.id, tenant.ownDomain),
    prisma.approvalItem.count({ where: { tenantId: tenant.id, module: 'aeo', status: 'PENDING' } }),
    prisma.seoKeyword.count({ where: { tenantId: tenant.id, isActive: true } }),
    getTopOpportunities(tenant.id),
    prisma.seoArticle.count({ where: { tenantId: tenant.id, status: 'PENDING' } }),
    prisma.nurtureLead.count({ where: { tenantId: tenant.id } }),
    prisma.nurtureSegment.count({ where: { tenantId: tenant.id } }),
    prisma.approvalItem.count({ where: { tenantId: tenant.id, module: 'nurturing', status: 'PENDING' } }),
    getMetricsSummary(tenant.id),
    getAttributionFunnel(tenant.id),
  ])

  const modules = [
    {
      key: 'AEO' as const,
      label: 'AEO',
      description: 'AI 検索対策',
      href: '/dashboard/aeo',
      pendingCount: aeoPending,
      stats: [
        { label: 'プロンプト', value: aeoPrompts.filter((p) => p.isActive).length },
        { label: 'ギャップ', value: aeoGaps.length },
        { label: '承認待ち', value: aeoPending, warn: aeoPending > 0 },
      ],
    },
    {
      key: 'SEO' as const,
      label: 'SEO',
      description: '検索エンジン最適化',
      href: '/dashboard/seo',
      pendingCount: seoPending,
      stats: [
        { label: 'キーワード', value: activeKeywordCount },
        { label: '改善機会', value: seoOpportunities.length },
        { label: '承認待ち', value: seoPending, warn: seoPending > 0 },
      ],
    },
    {
      key: 'ナーチャリング' as const,
      label: 'ナーチャリング',
      description: 'リード育成',
      href: '/dashboard/nurturing',
      pendingCount: nurturePendingCount,
      stats: [
        { label: 'リード', value: nurtureLeadCount },
        { label: 'セグメント', value: nurtureSegmentCount },
        { label: '承認待ち', value: nurturePendingCount, warn: nurturePendingCount > 0 },
      ],
    },
    {
      key: 'アナリティクス' as const,
      label: 'アナリティクス',
      description: 'サイトトラフィック (GA4)',
      href: '/dashboard/analytics',
      pendingCount: 0,
      stats: [
        { label: 'セッション(30日)', value: analyticsSummary.totalSessions.toLocaleString() },
        { label: 'オーガニック率', value: `${analyticsSummary.organicShare}%` },
        {
          label: '先週比',
          value: `${analyticsSummary.sessionsTrend > 0 ? '+' : ''}${analyticsSummary.sessionsTrend}%`,
        },
      ],
    },
    {
      key: 'アトリビューション' as const,
      label: 'アトリビューション',
      description: '施策 → 流入 → リード',
      href: '/dashboard/attribution',
      pendingCount: 0,
      stats: [
        {
          label: 'セッション→MQL',
          value: (() => {
            const sessions = attributionFunnel.steps[0]?.value ?? 0
            const mql = attributionFunnel.steps[3]?.value ?? 0
            return sessions > 0 ? `${((mql / sessions) * 100).toFixed(2)}%` : '-'
          })(),
        },
        { label: 'MQL', value: String(attributionFunnel.steps[3]?.value ?? 0) },
        { label: 'SQL/商談', value: String(attributionFunnel.steps[4]?.value ?? 0) },
      ],
    },
  ]

  const totalPending = aeoPending + seoPending + nurturePendingCount

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* ページヘッダー */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.name ?? user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <Link
              href="/dashboard/approval?status=PENDING"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
            >
              <Clock className="h-3 w-3" />
              承認待ち {totalPending} 件
            </Link>
          )}
          <Badge variant="secondary" className="text-xs">{user.role}</Badge>
        </div>
      </div>

      <SetupChecklist
        tenantId={tenant.id}
        ownDomain={tenant.ownDomain}
        serankingProjectId={tenant.serankingProjectId}
      />

      {/* モジュールカードグリッド */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const cfg = MODULE_CONFIG[mod.key]
          return (
            <Link key={mod.label} href={mod.href} className="group">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between">
                    <div className={cn('rounded-lg p-2', cfg.iconBg)}>
                      <cfg.Icon className={cn('h-4 w-4', cfg.iconColor)} />
                    </div>
                    {mod.pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        {mod.pendingCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="font-semibold text-base leading-tight">{mod.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <Separator className="mb-3" />
                  <div className="flex gap-4">
                    {mod.stats.map((s) => (
                      <div key={s.label}>
                        <p className={cn(
                          'text-xl font-bold tabular-nums',
                          'warn' in s && s.warn ? 'text-amber-600 dark:text-amber-400' : ''
                        )}>
                          {s.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    詳細を見る
                    <ChevronRight className="ml-0.5 h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
