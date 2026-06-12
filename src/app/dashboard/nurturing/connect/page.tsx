import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'HubSpot 設定 — ナーチャリング' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import HubSpotConnectForm from './hubspot-connect-form'
import HubSpotFilterForm from './hubspot-filter-form'

type Props = {
  params?: Promise<{ projectId?: string }>
  searchParams: Promise<{ connected?: string; error?: string }>
}

export default async function HubSpotConnectPage({ params, searchParams }: Props) {
  const { projectId } = (await params) ?? {}

  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')

  const { connected, error } = await searchParams

  const [connection, lastLeadSync, leadCount] = projectId
    ? await Promise.all([
        prisma.hubSpotConnection.findUnique({ where: { projectId } }),
        prisma.nurtureLead.findFirst({
          where: { tenantId: ctx.tenant.id, projectId },
          orderBy: { lastSyncedAt: 'desc' },
          select: { lastSyncedAt: true },
        }),
        prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, projectId } }),
      ])
    : [null, null, 0]

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

      {!projectId && (
        <div className="mb-4 rounded-md border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          プロジェクトを選択してから HubSpot を設定してください。
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
                <span className="text-muted-foreground">接続更新日</span>
                <span>{connection.updatedAt.toLocaleDateString('ja-JP')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">リード同期</span>
                <span>
                  {lastLeadSync?.lastSyncedAt
                    ? lastLeadSync.lastSyncedAt.toLocaleDateString('ja-JP')
                    : '未同期'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">取得済みリード数</span>
                <span className="font-medium">{leadCount.toLocaleString()} 件</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {projectId
                ? 'HubSpot Private App トークンを入力して接続してください。'
                : 'プロジェクトを選択してください。'}
            </p>
          )}
        </CardContent>
      </Card>

      {projectId && (
        <div className="space-y-6">
          <HubSpotConnectForm isConnected={!!connection} projectId={projectId} />
          {connection && (
            <HubSpotFilterForm
              projectId={projectId}
              initialFilter={connection.importFilter as { lifecycles?: string[]; leadStatuses?: string[] } | null}
            />
          )}
        </div>
      )}
    </div>
  )
}
