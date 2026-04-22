import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listPrompts, detectCitationGaps } from '@/modules/aeo'
import { listKeywords, getTopOpportunities } from '@/modules/seo'
import { listLeads, listSegments, listDrafts } from '@/modules/nurturing'
import { prisma } from '@/lib/db/client'

export default async function DashboardPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { user, tenant } = ctx

  const [
    aeoPrompts,
    aeoGaps,
    aeoPending,
    seoKeywords,
    seoOpportunities,
    seoPending,
    nurtureLeads,
    nurtureSegments,
    nurturePending,
    totalPending,
  ] = await Promise.all([
    listPrompts(tenant.id),
    detectCitationGaps(tenant.id, tenant.ownDomain),
    prisma.approvalItem.count({ where: { tenantId: tenant.id, module: 'aeo', status: 'PENDING' } }),
    listKeywords(tenant.id),
    getTopOpportunities(tenant.id),
    prisma.seoArticle.count({ where: { tenantId: tenant.id, status: 'PENDING' } }),
    listLeads(tenant.id),
    listSegments(tenant.id),
    listDrafts(tenant.id, 'PENDING'),
    prisma.approvalItem.count({ where: { tenantId: tenant.id, status: 'PENDING' } }),
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
        { label: 'キーワード', value: seoKeywords.filter((k) => k.isActive).length },
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
        { label: 'リード', value: nurtureLeads.length },
        { label: 'セグメント', value: nurtureSegments.length },
        { label: '承認待ち', value: nurturePending.length },
      ],
      ready: true,
    },
  ]

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{tenant.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.name ?? user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/approval?status=PENDING"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              承認キュー
              {totalPending > 0 && (
                <Badge className="ml-1 h-5 min-w-5 justify-center px-1 text-xs">
                  {totalPending}
                </Badge>
              )}
            </Link>
            <Badge variant="secondary">{user.role}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {modules.map((mod) => (
            <Link
              key={mod.label}
              href={mod.href}
              className={mod.ready ? '' : 'pointer-events-none'}
            >
              <Card className={`h-full transition-colors ${mod.ready ? 'hover:bg-accent/50 cursor-pointer' : 'opacity-50'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{mod.label}</CardTitle>
                    {!mod.ready && (
                      <Badge variant="outline" className="text-xs">準備中</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{mod.description}</p>
                </CardHeader>
                {mod.ready && mod.stats.length > 0 && (
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
    </main>
  )
}
