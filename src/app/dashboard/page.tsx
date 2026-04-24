import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'ダッシュボード' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import SetupChecklist from './setup-checklist'
import { listPrompts, detectCitationGaps } from '@/modules/aeo'
import { getTopOpportunities } from '@/modules/seo'
import { getMetricsSummary } from '@/modules/analytics'
import { getAttributionFunnel } from '@/modules/attribution'
import { prisma } from '@/lib/db/client'

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
      label: 'AEO',
      description: 'AI 検索対策',
      href: '/dashboard/aeo',
      stats: [
        { label: 'プロンプト', value: aeoPrompts.filter((p) => p.isActive).length },
        { label: 'ギャップ', value: aeoGaps.length },
        { label: '承認待ち', value: aeoPending },
      ],
      ready: true,
    },
    {
      label: 'SEO',
      description: '検索エンジン最適化',
      href: '/dashboard/seo',
      stats: [
        { label: 'キーワード', value: activeKeywordCount },
        { label: '改善機会', value: seoOpportunities.length },
        { label: '承認待ち', value: seoPending },
      ],
      ready: true,
    },
    {
      label: 'ナーチャリング',
      description: 'リード育成',
      href: '/dashboard/nurturing',
      stats: [
        { label: 'リード', value: nurtureLeadCount },
        { label: 'セグメント', value: nurtureSegmentCount },
        { label: '承認待ち', value: nurturePendingCount },
      ],
      ready: true,
    },
    {
      label: 'アナリティクス',
      description: 'サイトトラフィック (GA4)',
      href: '/dashboard/analytics',
      stats: [
        { label: 'セッション(30日)', value: analyticsSummary.totalSessions.toLocaleString() },
        { label: 'オーガニック率', value: `${analyticsSummary.organicShare}%` },
        { label: '先週比', value: `${analyticsSummary.sessionsTrend > 0 ? '+' : ''}${analyticsSummary.sessionsTrend}%` },
      ],
      ready: true,
    },
    {
      label: 'アトリビューション',
      description: '施策 → 流入 → リード',
      href: '/dashboard/attribution',
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
      ready: true,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.name ?? user.email}</p>
        </div>
        <Badge variant="secondary">{user.role}</Badge>
      </div>

      <SetupChecklist
        tenantId={tenant.id}
        ownDomain={tenant.ownDomain}
        serankingProjectId={tenant.serankingProjectId}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <Link key={mod.label} href={mod.href}>
            <Card className="h-full cursor-pointer transition-colors hover:bg-accent/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{mod.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{mod.description}</p>
              </CardHeader>
              {mod.stats.length > 0 && (
                <CardContent>
                  <div className="flex gap-4">
                    {mod.stats.map((s) => (
                      <div key={s.label}>
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
