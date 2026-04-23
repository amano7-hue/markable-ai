import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import SettingsForm from './settings-form'

export default async function SettingsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { tenant, user } = ctx

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">設定</h1>

      {/* ワークスペース設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ワークスペース</CardTitle>
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
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">名前</span>
            <span>{user.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">メールアドレス</span>
            <span>{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ロール</span>
            <span>{user.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">テナント ID</span>
            <span className="font-mono text-xs text-muted-foreground">{tenant.id}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
