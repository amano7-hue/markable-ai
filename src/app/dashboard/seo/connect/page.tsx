import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = { title: 'GSC 接続 — SEO' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { prisma } from '@/lib/db/client'
import SiteUrlForm from './site-url-form'

export default async function GscConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { connected, error } = await searchParams

  const connection = await prisma.gscConnection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">Google Search Console 設定</h1>

      {connected && (
        <div className="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          GSC の接続が完了しました。
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          接続中にエラーが発生しました。再度お試しください。
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            接続状況
            <Badge variant={connection ? 'secondary' : 'outline'}>
              {connection ? '接続済み' : '未接続'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connection ? (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Google アカウント</span>
                  <span>{connection.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最終更新</span>
                  <span>{connection.updatedAt.toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
              <Separator />
              <SiteUrlForm currentSiteUrl={connection.siteUrl ?? ''} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Google Search Console に接続すると、実際のキーワード順位・クリックデータを取得できます。
            </p>
          )}

          <a
            href="/api/auth/gsc"
            className={buttonVariants({ variant: connection ? 'outline' : 'default', className: 'w-full' })}
          >
            {connection ? 'アカウントを再接続' : 'Google Search Console に接続'}
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
