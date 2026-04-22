import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listLeads, listSegments, listDrafts } from '@/modules/nurturing'
import { prisma } from '@/lib/db/client'

export default async function NurturingPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [leads, segments, pendingDrafts, connection] = await Promise.all([
    listLeads(ctx.tenant.id),
    listSegments(ctx.tenant.id),
    listDrafts(ctx.tenant.id, 'PENDING'),
    prisma.hubSpotConnection.findUnique({ where: { tenantId: ctx.tenant.id } }),
  ])

  const mqlLeads = leads.filter((l) => l.lifecycle === 'marketingqualifiedlead').length
  const highScoreLeads = leads.filter((l) => l.icpScore >= 50).length

  const stats = [
    { label: 'リード総数', value: leads.length, href: '/dashboard/nurturing/leads' },
    { label: 'MQL 数', value: mqlLeads, href: '/dashboard/nurturing/leads' },
    { label: 'ICP スコア 50+', value: highScoreLeads, href: '/dashboard/nurturing/leads' },
    { label: 'セグメント数', value: segments.length, href: '/dashboard/nurturing/segments' },
    { label: 'メール承認待ち', value: pendingDrafts.length, href: '/dashboard/nurturing/emails' },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ナーチャリング ダッシュボード</h1>
        {!connection && (
          <Link
            href="/dashboard/nurturing/connect"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            HubSpot を接続
          </Link>
        )}
      </div>

      {!connection && (
        <div className="mb-6 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          HubSpot が未接続のためモックデータを表示しています。
          <Link href="/dashboard/nurturing/connect" className="ml-1 underline">
            HubSpot 設定
          </Link>
          から接続してください。
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
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
