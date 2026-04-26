import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: '設定' }
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import SettingsForm from './settings-form'
import { prisma } from '@/lib/db/client'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function SettingsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { tenant, user } = ctx

  const [ga4Connection, hubspotConnection] = await Promise.all([
    prisma.ga4Connection.findUnique({ where: { tenantId: tenant.id }, select: { propertyId: true } }),
    prisma.hubSpotConnection.findUnique({ where: { tenantId: tenant.id }, select: { portalId: true } }),
  ])

  const integrations = [
    {
      label: 'GA4 (Google Analytics)',
      description: 'サイトトラフィック・セッションデータ',
      connected: !!ga4Connection?.propertyId,
      detail: ga4Connection?.propertyId ? `プロパティ: ${ga4Connection.propertyId}` : null,
      href: '/dashboard/analytics/connect',
    },
    {
      label: 'HubSpot CRM',
      description: 'リード同期・ナーチャリング',
      connected: !!hubspotConnection?.portalId,
      detail: hubspotConnection?.portalId ? `ポータル: ${hubspotConnection.portalId}` : null,
      href: '/dashboard/nurturing/connect',
    },
    {
      label: 'Seranking (SEO)',
      description: 'キーワード順位追跡',
      connected: !!tenant.serankingProjectId,
      detail: tenant.serankingProjectId ? `プロジェクト ID: ${tenant.serankingProjectId}` : null,
      href: '/dashboard/settings',
    },
    {
      label: '自社ドメイン',
      description: 'AEO 引用ギャップ検出に必要',
      connected: !!tenant.ownDomain,
      detail: tenant.ownDomain ?? null,
      href: '/dashboard/settings',
    },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">ワークスペースの基本情報と外部連携を管理します。</p>
      </div>

      {/* 連携ステータス */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">連携ステータス</CardTitle>
          <CardDescription>外部サービスとの接続状況</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {integrations.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center gap-3">
                    {item.connected ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.connected && item.detail ? item.detail : item.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.connected ? 'secondary' : 'outline'}
                      className={cn('text-xs', item.connected
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'text-muted-foreground'
                      )}
                    >
                      {item.connected ? '接続済み' : '未接続'}
                    </Badge>
                    {!item.connected && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Separator />

      {/* ワークスペース設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ワークスペース</CardTitle>
          <CardDescription>会社名・ドメイン・Seranking プロジェクトの設定</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            name={tenant.name}
            ownDomain={tenant.ownDomain}
            serankingProjectId={tenant.serankingProjectId}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* アカウント情報（読み取り専用） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">アカウント情報</CardTitle>
          <CardDescription>Clerk で管理されているアカウントの情報</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-1">
              <dt className="text-muted-foreground">名前</dt>
              <dd className="font-medium">{user.name ?? '—'}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-1">
              <dt className="text-muted-foreground">メールアドレス</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-1">
              <dt className="text-muted-foreground">ロール</dt>
              <dd>
                <Badge variant="secondary" className="text-xs">{user.role}</Badge>
              </dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-1">
              <dt className="text-muted-foreground">テナント ID</dt>
              <dd className="font-mono text-xs text-muted-foreground">{tenant.id}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
