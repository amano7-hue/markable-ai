import React from 'react'
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
  CheckCircle2,
  Sparkles,
  UserPlus,
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

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

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
    aiGeneratedThisWeek,
    aiApprovedThisWeek,
    aiByModule,
    newLeadsThisWeek,
    newArticlesThisWeek,
    lastGscSnapshot,
    lastAeoSnapshot,
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
    prisma.approvalItem.count({ where: { tenantId: tenant.id, createdAt: { gte: weekAgo } } }),
    prisma.approvalItem.count({ where: { tenantId: tenant.id, status: 'APPROVED', reviewedAt: { gte: weekAgo } } }),
    prisma.approvalItem.groupBy({
      by: ['module'],
      where: { tenantId: tenant.id, createdAt: { gte: weekAgo } },
      _count: true,
    }),
    prisma.nurtureLead.count({ where: { tenantId: tenant.id, createdAt: { gte: weekAgo } } }),
    prisma.seoArticle.count({ where: { tenantId: tenant.id, createdAt: { gte: weekAgo } } }),
    prisma.seoKeywordSnapshot.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    }),
    prisma.aeoRankSnapshot.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    }),
  ])

  // 先週との比較（直前 7〜14 日）
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const [prevWeekLeads, prevWeekApproved, prevWeekGenerated, recentItems] = await Promise.all([
    prisma.nurtureLead.count({ where: { tenantId: tenant.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.approvalItem.count({ where: { tenantId: tenant.id, status: 'APPROVED', reviewedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.approvalItem.count({ where: { tenantId: tenant.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    // 最近の AI 生成アイテム（承認状態に関わらず直近 5 件）
    prisma.approvalItem.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, module: true, type: true, status: true, createdAt: true, payload: true },
    }),
  ])

  function weekDelta(current: number, previous: number) {
    if (previous === 0) return null
    return Math.round(((current - previous) / previous) * 100)
  }

  const aiByModuleMap = Object.fromEntries(aiByModule.map((r) => [r.module, r._count]))

  function daysAgo(date: Date) {
    return Math.floor((Date.now() - date.getTime()) / 86_400_000)
  }
  const gscStaleDays = lastGscSnapshot ? daysAgo(lastGscSnapshot.snapshotDate) : null
  const aeoStaleDays = lastAeoSnapshot ? daysAgo(lastAeoSnapshot.snapshotDate) : null
  const gscStale = gscStaleDays !== null && gscStaleDays >= 3 && activeKeywordCount > 0

  // AEO health: citation rate of active prompts
  const activePrompts = aeoPrompts.filter((p) => p.isActive)
  const aeoStale = aeoStaleDays !== null && aeoStaleDays >= 3 && activePrompts.length > 0
  const citedCount = activePrompts.filter(
    (p) => Object.values(p.citationsByEngine).some((rank) => rank !== null),
  ).length
  const aeoCitationRate = activePrompts.length > 0 ? Math.round((citedCount / activePrompts.length) * 100) : null
  const aeoHealth: 'good' | 'warn' | 'bad' =
    aeoCitationRate === null ? 'warn' : aeoCitationRate >= 50 ? 'good' : aeoCitationRate >= 20 ? 'warn' : 'bad'

  // SEO health: active keywords with position data
  const seoHealth: 'good' | 'warn' | 'bad' =
    activeKeywordCount === 0 ? 'warn' : seoPending > 5 ? 'warn' : 'good'

  // Nurturing health: leads exist + segments
  const nurturingHealth: 'good' | 'warn' | 'bad' =
    nurtureLeadCount === 0 ? 'bad' : nurtureSegmentCount === 0 ? 'warn' : 'good'

  const totalPendingApprovals = aeoPending + seoPending + nurturePendingCount

  const modules = [
    {
      key: 'AEO' as const,
      label: 'AEO',
      description: 'AI 検索対策',
      href: '/dashboard/aeo',
      pendingCount: aeoPending,
      health: aeoHealth,
      healthLabel: aeoCitationRate !== null ? `引用率 ${aeoCitationRate}%` : 'データなし',
      stats: [
        { label: 'プロンプト', value: activePrompts.length },
        { label: 'ギャップ', value: aeoGaps.length, warn: aeoGaps.length > 0 },
        { label: '承認待ち', value: aeoPending, warn: aeoPending > 0 },
      ],
    },
    {
      key: 'SEO' as const,
      label: 'SEO',
      description: '検索エンジン最適化',
      href: '/dashboard/seo',
      pendingCount: seoPending,
      health: seoHealth,
      healthLabel: activeKeywordCount > 0 ? `${activeKeywordCount} キーワード追跡中` : 'キーワード未設定',
      stats: [
        { label: 'キーワード', value: activeKeywordCount },
        { label: '改善機会', value: seoOpportunities.length, warn: seoOpportunities.length > 0 },
        { label: '承認待ち', value: seoPending, warn: seoPending > 0 },
      ],
    },
    {
      key: 'ナーチャリング' as const,
      label: 'ナーチャリング',
      description: 'リード育成',
      href: '/dashboard/nurturing',
      pendingCount: nurturePendingCount,
      health: nurturingHealth,
      healthLabel: nurtureLeadCount > 0 ? `${nurtureLeadCount} 件リード` : 'リードなし',
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
      health: analyticsSummary.organicShare >= 30 ? ('good' as const) : ('warn' as const),
      healthLabel: `オーガニック率 ${analyticsSummary.organicShare}%`,
      stats: [
        { label: 'セッション(30日)', value: analyticsSummary.totalSessions.toLocaleString() },
        { label: 'オーガニック率', value: `${analyticsSummary.organicShare}%` },
        {
          label: '先週比',
          value: `${analyticsSummary.sessionsTrend > 0 ? '+' : ''}${analyticsSummary.sessionsTrend}%`,
          warn: analyticsSummary.sessionsTrend < 0,
        },
      ],
    },
    {
      key: 'アトリビューション' as const,
      label: 'アトリビューション',
      description: '施策 → 流入 → リード',
      href: '/dashboard/attribution',
      pendingCount: 0,
      health: 'good' as const,
      healthLabel: `MQL ${attributionFunnel.steps[3]?.value ?? 0} 件`,
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* ページヘッダー */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.name ?? user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {totalPendingApprovals > 0 && (
            <Link
              href="/dashboard/approval?status=PENDING"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
            >
              <Clock className="h-3 w-3" />
              承認待ち {totalPendingApprovals} 件
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

      {/* 次にやること */}
      {(() => {
        const actions: { label: string; href: string; priority: 'high' | 'medium' }[] = []
        if (totalPendingApprovals > 0)
          actions.push({ label: `承認待ち ${totalPendingApprovals} 件をレビュー`, href: '/dashboard/approval?status=PENDING', priority: 'high' })
        if (aeoGaps.length > 0)
          actions.push({ label: `AEO 引用ギャップ ${aeoGaps.length} 件に対応`, href: '/dashboard/aeo/gaps', priority: 'high' })
        if (nurturingHealth === 'bad')
          actions.push({ label: 'HubSpot を接続してリードを同期', href: '/dashboard/nurturing/connect', priority: 'high' })
        if (seoOpportunities.length > 0)
          actions.push({ label: `SEO 改善機会 ${seoOpportunities.length} 件の記事を生成`, href: '/dashboard/seo/opportunities', priority: 'medium' })
        if (nurtureSegmentCount === 0 && nurtureLeadCount > 0)
          actions.push({ label: 'ナーチャリングのセグメントを作成', href: '/dashboard/nurturing/segments/new', priority: 'medium' })
        if (aeoCitationRate !== null && aeoCitationRate < 20)
          actions.push({ label: `AEO 引用率 ${aeoCitationRate}% — 未引用プロンプトの提案を生成`, href: '/dashboard/aeo/prompts', priority: 'medium' })
        if (gscStale)
          actions.push({ label: `GSC データが ${gscStaleDays}日 未更新 — キーワードを同期`, href: '/dashboard/seo/keywords', priority: 'medium' })
        if (aeoStale)
          actions.push({ label: `AEO データが ${aeoStaleDays}日 未更新 — プロンプトを同期`, href: '/dashboard/aeo/prompts', priority: 'medium' })
        if (actions.length === 0) return null
        return (
          <div className="mb-8 rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">次にやること</h2>
            <ul className="space-y-1.5">
              {actions.slice(0, 5).map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        action.priority === 'high' ? 'bg-destructive' : 'bg-amber-500',
                      )} />
                      {action.label}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })()}

      {/* モジュールカードグリッド */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const cfg = MODULE_CONFIG[mod.key]
          const healthColors = {
            good: 'bg-emerald-500',
            warn: 'bg-amber-500',
            bad: 'bg-destructive',
          }
          return (
            <Link key={mod.label} href={mod.href} className="group">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between">
                    <div className={cn('rounded-lg p-2', cfg.iconBg)}>
                      <cfg.Icon className={cn('h-4 w-4', cfg.iconColor)} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {mod.pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          {mod.pendingCount}
                        </span>
                      )}
                      <span
                        title={mod.healthLabel}
                        className={cn('h-2 w-2 rounded-full', healthColors[mod.health])}
                      />
                    </div>
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
                  <div className="mt-3 flex items-center justify-between">
                    <p className="flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      詳細を見る
                      <ChevronRight className="ml-0.5 h-3 w-3" />
                    </p>
                    <span className={cn(
                      'text-xs font-medium',
                      mod.health === 'good' ? 'text-emerald-600 dark:text-emerald-400' :
                      mod.health === 'warn' ? 'text-amber-600 dark:text-amber-400' :
                      'text-destructive'
                    )}>
                      {mod.healthLabel}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* AI 自動化パイプライン */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">今週の AI 自動化アクティビティ</h2>
          </div>
          {aiGeneratedThisWeek > 0 && (
            <span className={cn(
              'text-xs font-medium',
              aiApprovedThisWeek / aiGeneratedThisWeek >= 0.7
                ? 'text-emerald-600 dark:text-emerald-400'
                : aiApprovedThisWeek / aiGeneratedThisWeek >= 0.3
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground',
            )}>
              自動化効率 {Math.round((aiApprovedThisWeek / aiGeneratedThisWeek) * 100)}%
            </span>
          )}
        </div>
        {(() => {
          type PipelineItem = {
            label: string
            value: number
            sub: string
            delta: number | null
            Icon: React.ComponentType<{ className?: string }>
            color: string
            href?: string
          }
          const pipelineItems: PipelineItem[] = [
            {
              label: 'AI が生成',
              value: aiGeneratedThisWeek,
              sub: '件の提案・ドラフト',
              delta: weekDelta(aiGeneratedThisWeek, prevWeekGenerated),
              Icon: Sparkles,
              color: 'text-primary',
            },
            {
              label: '承認待ち',
              value: totalPendingApprovals,
              sub: '件のレビューが必要',
              delta: null,
              Icon: Clock,
              color: totalPendingApprovals > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
              href: totalPendingApprovals > 0 ? '/dashboard/approval?status=PENDING' : undefined,
            },
            {
              label: '今週承認済み',
              value: aiApprovedThisWeek,
              sub: '件を適用',
              delta: weekDelta(aiApprovedThisWeek, prevWeekApproved),
              Icon: CheckCircle2,
              color: aiApprovedThisWeek > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            },
            {
              label: '新規リード',
              value: newLeadsThisWeek,
              sub: '件 (今週)',
              delta: weekDelta(newLeadsThisWeek, prevWeekLeads),
              Icon: UserPlus,
              color: newLeadsThisWeek > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            },
          ]
          return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pipelineItems.map((item) => (
            item.href ? (
              <Link key={item.label} href={item.href}>
                <Card className="transition-colors hover:border-primary/30">
                  <CardContent className="pt-4 pb-3">
                    <item.Icon className={cn('mb-2 h-4 w-4', item.color)} />
                    <p className={cn('text-2xl font-bold tabular-nums', item.color)}>{item.value}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                    {'delta' in item && item.delta !== null && (
                      <p className={cn('mt-1 text-xs font-medium', item.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                        {item.delta >= 0 ? `+${item.delta}%` : `${item.delta}%`} 先週比
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card key={item.label}>
                <CardContent className="pt-4 pb-3">
                  <item.Icon className={cn('mb-2 h-4 w-4', item.color)} />
                  <p className={cn('text-2xl font-bold tabular-nums', item.color)}>{item.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                  {'delta' in item && item.delta !== null && (
                    <p className={cn('mt-1 text-xs font-medium', item.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                      {item.delta >= 0 ? `+${item.delta}%` : `${item.delta}%`} 先週比
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          ))}
        </div>
          )
        })()}
        {(aiByModuleMap['aeo'] || aiByModuleMap['seo'] || aiByModuleMap['nurturing'] || newLeadsThisWeek > 0 || newArticlesThisWeek > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {aiByModuleMap['aeo'] ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                AEO: {aiByModuleMap['aeo']} 件生成
              </span>
            ) : null}
            {aiByModuleMap['seo'] ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300">
                SEO: 記事 {newArticlesThisWeek} 件生成
              </span>
            ) : null}
            {aiByModuleMap['nurturing'] ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ナーチャリング: {aiByModuleMap['nurturing']} 件生成
              </span>
            ) : null}
            {newLeadsThisWeek > 0 ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                新規リード +{newLeadsThisWeek} 件
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* 最近の AI 生成アイテム */}
      {recentItems.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">最近の AI 生成</h2>
            <Link
              href="/dashboard/approval"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              すべて見る →
            </Link>
          </div>
          <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
            {recentItems.map((item) => {
              const MODULE_LABELS: Record<string, string> = { aeo: 'AEO', seo: 'SEO', nurturing: 'ナーチャリング' }
              const TYPE_LABELS: Record<string, string> = {
                aeo_suggestion: 'AEO 改善提案',
                seo_article_draft: 'SEO 記事ドラフト',
                nurturing_email_draft: 'メールドラフト',
              }
              const ITEM_HREFS: Record<string, string> = {
                aeo: '/dashboard/aeo/suggestions',
                seo: '/dashboard/seo/articles',
                nurturing: '/dashboard/nurturing/emails',
              }
              const p = item.payload as Record<string, string>
              const preview =
                item.type === 'aeo_suggestion' ? p.suggestion?.slice(0, 80)
                : item.type === 'seo_article_draft' ? p.title
                : item.type === 'nurturing_email_draft' ? p.subject
                : null
              const href = ITEM_HREFS[item.module] ?? '/dashboard/approval'
              const isNew = item.status === 'PENDING'
              return (
                <Link key={item.id} href={href} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                  <div className="mt-0.5 shrink-0">
                    <span className={cn(
                      'inline-block h-2 w-2 rounded-full',
                      item.status === 'PENDING' ? 'bg-amber-500' :
                      item.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {MODULE_LABELS[item.module] ?? item.module}
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                    </div>
                    {preview && (
                      <p className="mt-0.5 truncate text-sm">{preview}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn(
                      'text-xs font-medium',
                      item.status === 'PENDING' ? 'text-amber-600 dark:text-amber-400' :
                      item.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-400' :
                      'text-muted-foreground'
                    )}>
                      {item.status === 'PENDING' ? '承認待ち' : item.status === 'APPROVED' ? '承認済み' : '却下'}
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.createdAt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
