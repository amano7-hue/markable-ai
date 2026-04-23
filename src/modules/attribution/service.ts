import { prisma } from '@/lib/db/client'

export interface FunnelStep {
  label: string
  value: number
  rate: number | null // 前ステップからの転換率 %
}

export interface AttributionFunnel {
  steps: FunnelStep[]
  period: string
}

export async function getAttributionFunnel(tenantId: string): Promise<AttributionFunnel> {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [ga4, leads] = await Promise.all([
    prisma.ga4DailyMetric.aggregate({
      where: { tenantId, date: { gte: since30 } },
      _sum: { sessions: true, organicSessions: true },
    }),
    prisma.nurtureLead.groupBy({
      by: ['lifecycle'],
      where: { tenantId },
      _count: { id: true },
    }),
  ])

  const totalSessions = ga4._sum.sessions ?? 0
  const organicSessions = ga4._sum.organicSessions ?? 0

  const countByLifecycle = Object.fromEntries(
    leads.map((r) => [r.lifecycle ?? 'unknown', r._count.id])
  )
  const totalLeads = leads.reduce((s, r) => s + r._count.id, 0)
  const mqlCount = countByLifecycle['marketingqualifiedlead'] ?? 0
  const sqlCount = (countByLifecycle['salesqualifiedlead'] ?? 0) + (countByLifecycle['opportunity'] ?? 0)

  const steps: FunnelStep[] = [
    {
      label: 'セッション (30日)',
      value: totalSessions,
      rate: null,
    },
    {
      label: 'オーガニックセッション',
      value: organicSessions,
      rate: totalSessions > 0 ? Math.round((organicSessions / totalSessions) * 100) : null,
    },
    {
      label: 'リード (累計)',
      value: totalLeads,
      rate: null,
    },
    {
      label: 'MQL',
      value: mqlCount,
      rate: totalLeads > 0 ? Math.round((mqlCount / totalLeads) * 100) : null,
    },
    {
      label: 'SQL / 商談',
      value: sqlCount,
      rate: mqlCount > 0 ? Math.round((sqlCount / mqlCount) * 100) : null,
    },
  ]

  return { steps, period: '直近 30 日' }
}

export interface SeoAttributionRow {
  keyword: string
  latestPosition: number | null // 小数点なしに丸め済み
  clicks30d: number
  impressions30d: number
}

export async function getSeoAttribution(tenantId: string): Promise<SeoAttributionRow[]> {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const keywords = await prisma.seoKeyword.findMany({
    where: { tenantId, isActive: true },
    include: {
      snapshots: {
        where: { snapshotDate: { gte: since30 } },
        orderBy: { snapshotDate: 'desc' },
      },
    },
  })

  return keywords
    .map((kw) => {
      const latest = kw.snapshots[0]
      const clicks30d = kw.snapshots.reduce((s, r) => s + r.clicks, 0)
      const impressions30d = kw.snapshots.reduce((s, r) => s + r.impressions, 0)
      return {
        keyword: kw.text,
        latestPosition: latest?.position != null ? Math.round(latest.position) : null,
        clicks30d,
        impressions30d,
      }
    })
    .sort((a, b) => (b.clicks30d - a.clicks30d))
    .slice(0, 20)
}

export interface ModuleActivity {
  module: string
  label: string
  pending: number
  approved: number
  total: number
}

export async function getModuleActivity(tenantId: string): Promise<ModuleActivity[]> {
  const items = await prisma.approvalItem.groupBy({
    by: ['module', 'status'],
    where: { tenantId },
    _count: { id: true },
  })

  const moduleMap = new Map<string, { pending: number; approved: number; total: number }>()

  for (const item of items) {
    const existing = moduleMap.get(item.module) ?? { pending: 0, approved: 0, total: 0 }
    existing.total += item._count.id
    if (item.status === 'PENDING') existing.pending += item._count.id
    if (item.status === 'APPROVED') existing.approved += item._count.id
    moduleMap.set(item.module, existing)
  }

  const MODULE_LABELS: Record<string, string> = {
    aeo: 'AEO',
    seo: 'SEO',
    nurturing: 'ナーチャリング',
  }

  return Array.from(moduleMap.entries()).map(([module, counts]) => ({
    module,
    label: MODULE_LABELS[module] ?? module,
    ...counts,
  }))
}
