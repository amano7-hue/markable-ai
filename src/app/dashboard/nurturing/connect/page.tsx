import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'HubSpot 設定 — ナーチャリング' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import HubSpotConnectForm from './hubspot-connect-form'

export default async function HubSpotConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { connected, error } = await searchParams

  const connection = await prisma.hubSpotConnection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">HubSpot 設定</h1>

      {connected && (
        <div className="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          HubSpot の接続が完了しました。
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          接続中にエラーが発生しました。API キーを確認してください。
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            接続状況
            <Badge variant={connection ? 'secondary' : 'outline'}>
              {connection ? '接続済み' : '未接続'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connection ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Portal ID</span>
                <span className="font-mono">{connection.portalId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">最終更新</span>
                <span>{connection.updatedAt.toLocaleDateString('ja-JP')}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              HubSpot Private App トークンを入力して接続してください。
            </p>
          )}
        </CardContent>
      </Card>

      <HubSpotConnectForm isConnected={!!connection} />
    </div>
  )
}
