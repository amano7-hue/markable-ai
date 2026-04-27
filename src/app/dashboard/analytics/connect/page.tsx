import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'GA4 接続 — アナリティクス' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import Ga4PropertyForm from './ga4-property-form'

export default async function Ga4ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { connected, error } = await searchParams

  const [connection, lastMetric, metricCount] = await Promise.all([
    prisma.ga4Connection.findUnique({ where: { tenantId: ctx.tenant.id } }),
    prisma.ga4DailyMetric.findFirst({
      where: { tenantId: ctx.tenant.id },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
    prisma.ga4DailyMetric.count({ where: { tenantId: ctx.tenant.id } }),
  ])

  const isFullyConnected = !!connection?.propertyId

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">Google Analytics 4 設定</h1>

      {connected && (
        <div className="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Google アカウントの連携が完了しました。プロパティ ID を入力してください。
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          接続中にエラーが発生しました。再度お試しください。
        </div>
      )}

      {/* Step 1: Google OAuth */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Step 1 — Google アカウント連携
            <Badge variant={connection ? 'secondary' : 'outline'}>
              {connection ? '完了' : '未接続'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connection ? (
            <p className="text-sm text-muted-foreground">
              {connection.email} で連携済み
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Google Analytics のデータにアクセスするために Google アカウントを連携します。
            </p>
          )}
          <a
            href="/api/auth/ga4"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {connection ? 'アカウントを再連携' : 'Google アカウントを連携'}
          </a>
        </CardContent>
      </Card>

      {/* Step 2: Property ID */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Step 2 — GA4 プロパティ ID
            <Badge variant={isFullyConnected ? 'secondary' : 'outline'}>
              {isFullyConnected ? '設定済み' : '未設定'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isFullyConnected && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">プロパティ ID</span>
                <span className="font-mono">{connection.propertyId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">データ最終日</span>
                <span>{lastMetric?.date ? lastMetric.date.toLocaleDateString('ja-JP') : '未同期'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">取得済みデータ日数</span>
                <span className="font-medium">{metricCount.toLocaleString()} 日分</span>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            GA4 管理画面 → プロパティ設定 → 「プロパティ ID」に表示される数値を入力してください。
          </p>
          <Ga4PropertyForm disabled={!connection} currentPropertyId={connection?.propertyId ?? ''} />
        </CardContent>
      </Card>
    </div>
  )
}
