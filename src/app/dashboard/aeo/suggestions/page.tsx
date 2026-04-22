import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import { parseAeoSuggestionPayload } from '@/modules/aeo'
import ApproveButton from './approve-button'

const STATUS_LABELS: Record<string, string> = {
  PENDING: '承認待ち',
  APPROVED: '承認済み',
  REJECTED: '却下',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'default',
  APPROVED: 'secondary',
  REJECTED: 'destructive',
}

export default async function SuggestionsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const items = await prisma.approvalItem.findMany({
    where: { tenantId: ctx.tenant.id, module: 'aeo' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">改善提案</h1>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          改善提案がありません。プロンプト詳細ページから生成できます。
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            let payload: ReturnType<typeof parseAeoSuggestionPayload> | null = null
            try {
              payload = parseAeoSuggestionPayload(item.payload)
            } catch {
              // invalid payload
            }

            return (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {payload?.promptText ?? '不明なプロンプト'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.createdAt.toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANTS[item.status] ?? 'outline'}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {payload && (
                    <div className="rounded-md bg-muted p-3 text-sm">
                      {payload.suggestion}
                    </div>
                  )}
                  {item.status === 'PENDING' && (
                    <ApproveButton id={item.id} />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
