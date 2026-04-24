import type { Metadata } from 'next'
import Link from 'next/link'
import { getAuth } from '@/lib/auth/get-auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'AEO' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listPrompts, detectCitationGaps } from '@/modules/aeo'
import { prisma } from '@/lib/db/client'

export default async function AeoPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [prompts, gaps, pendingApprovals] = await Promise.all([
    listPrompts(ctx.tenant.id),
    detectCitationGaps(ctx.tenant.id, ctx.tenant.ownDomain),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, module: 'aeo', status: 'PENDING' },
    }),
  ])

  const activePrompts = prompts.filter((p) => p.isActive).length
  const citedCount = prompts.filter(
    (p) =>
      Object.values(p.citationsByEngine).some((rank) => rank !== null),
  ).length
  const citationRate =
    activePrompts > 0 ? Math.round((citedCount / activePrompts) * 100) : 0

  const stats = [
    { label: 'アクティブプロンプト', value: activePrompts, href: '/dashboard/aeo/prompts' },
    { label: '自社引用率', value: `${citationRate}%`, href: '/dashboard/aeo/prompts' },
    { label: '引用ギャップ', value: gaps.length, href: '/dashboard/aeo/gaps' },
    { label: '承認待ち', value: pendingApprovals, href: '/dashboard/aeo/suggestions' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">AEO ダッシュボード</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:bg-accent/50 transition-colors">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
