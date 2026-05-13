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
import { CheckCircle2, XCircle, ChevronRight, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function SettingsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { tenant, user } = ctx

  const [ga4Connection, hubspotConnection, gscConnection, lastGa4Sync, lastGscSync, lastLeadSync] = await Promise.all([
    prisma.ga4Connection.findFirst({ where: { tenantId: tenant.id }, select: { propertyId: true, updatedAt: true } }),
    prisma.hubSpotConnection.findFirst({ where: { tenantId: tenant.id }, select: { portalId: true, updatedAt: true } }),
    prisma.gscConnection.findFirst({ where: { tenantId: tenant.id }, select: { siteUrl: true, updatedAt: true } }),
    prisma.ga4DailyMetric.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
    prisma.seoKeywordSnapshot.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    }),
    prisma.nurtureLead.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true },
    }),
  ])

  function fmtDate(d: Date | null | undefined) {
    if (!d) return null
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function staleDays(d: Date | null | undefined): number | null {
    if (!d) return null
    return Math.floor((Date.now() - d.getTime()) / 86_400_000)
  }

  const integrations = [
    {
      label: 'Google Analytics 4',
      description: 'サイトトラフィック・セッションデータ',
      connected: !!ga4Connection?.propertyId,
      detail: ga4Connection?.propertyId ? `プロパティ: ${ga4Connection.propertyId}` : null,
      lastSync: fmtDate(lastGa4Sync?.date),
      stale: !!ga4Connection?.propertyId && (staleDays(lastGa4Sync?.date) ?? 0) >= 3,
      href: '/dashboard/analytics/connect',
    },
    {
      label: 'Google Search Console',
      description: 'キーワード順位・クリックデータ',
      connected: !!gscConnection?.siteUrl,
      detail: gscConnection?.siteUrl ?? null,
      lastSync: fmtDate(lastGscSync?.snapshotDate),
      stale: !!gscConnection?.siteUrl && (staleDays(lastGscSync?.snapshotDate) ?? 0) >= 3,
      href: '/dashboard/seo/connect',
    },
    {
      label: 'HubSpot CRM',
      description: 'リード同期・ナーチャリング',
      connected: !!hubspotConnection?.portalId,
      detail: hubspotConnection?.portalId ? `ポータル: ${hubspotConnection.portalId}` : null,
      lastSync: fmtDate(lastLeadSync?.lastSyncedAt),
      stale: !!hubspotConnection?.portalId && (staleDays(lastLeadSync?.lastSyncedAt) ?? 0) >= 3,
      href: '/dashboard/nurturing/connect',
    },
    {
      label: '自社ドメイン',
      description: 'LLMO 引用ギャップ検出に必要',
      connected: !!tenant.ownDomain,
      detail: tenant.ownDomain ?? null,
      lastSync: null,
      stale: false,
      href: '/dashboard/settings',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">テナント設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">全プロジェクト共通のワークスペース設定・外部連携を管理します。プロジェクト別の設定は各プロジェクトの「設定」から行ってください。</p>
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
                      {item.connected && item.lastSync && (
                        <p className={cn('text-xs', item.stale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/60')}>
                          最終同期: {item.lastSync}{item.stale ? ' — 更新を推奨' : ''}
                        </p>
                      )}
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

      {/* プロジェクト管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">プロジェクト管理</CardTitle>
          <CardDescription>ドメイン・サイト単位でデータを分離して管理します</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Link
            href="/dashboard/settings/projects"
            className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center gap-3">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium">プロジェクト一覧・追加</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Separator />

      {/* ワークスペース設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ワークスペース</CardTitle>
          <CardDescription>会社名・ドメインの設定</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            name={tenant.name}
            ownDomain={tenant.ownDomain}
            slackWebhookUrl={tenant.slackWebhookUrl ?? null}
            wpUrl={tenant.wpUrl ?? null}
            wpUsername={tenant.wpUsername ?? null}
            wpAppPassword={tenant.wpAppPassword ?? null}
            resendFrom={tenant.resendFrom ?? null}
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
