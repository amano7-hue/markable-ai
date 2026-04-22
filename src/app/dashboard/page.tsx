import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const ctx = await getAuth()

  if (!ctx) redirect('/onboarding')

  const { user, tenant } = ctx

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{tenant.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.name ?? user.email}
            </p>
          </div>
          <Badge variant="secondary">{user.role}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ModuleCard label="AEO" description="AI 検索対策" status="準備中" />
          <ModuleCard label="SEO" description="検索エンジン最適化" status="準備中" />
          <ModuleCard label="ナーチャリング" description="リード育成" status="準備中" />
        </div>
      </div>
    </main>
  )
}

function ModuleCard({
  label,
  description,
  status,
}: {
  label: string
  description: string
  status: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold text-foreground">{status}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
