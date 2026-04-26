import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: '設定' }
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import SettingsForm from './settings-form'

export default async function SettingsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { tenant, user } = ctx

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">ワークスペースの基本情報と外部連携を管理します。</p>
      </div>

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
