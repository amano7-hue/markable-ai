import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import { parseAeoSuggestionPayload } from '@/modules/aeo'
import ApproveButton from './approve-button'

type Props = { searchParams: Promise<{ status?: string }> }

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

const FILTER_TABS = [
  { value: '', label: 'すべて' },
  { value: 'PENDING', label: '承認待ち' },
  { value: 'APPROVED', label: '承認済み' },
  { value: 'REJECTED', label: '却下' },
]

export default async function SuggestionsPage({ searchParams }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { status } = await searchParams

  const [items, statusCounts] = await Promise.all([
    prisma.approvalItem.findMany({
      where: {
        tenantId: ctx.tenant.id,
        module: 'aeo',
        ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.approvalItem.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenant.id, module: 'aeo' },
      _count: true,
    }),
  ])

  const total = statusCounts.reduce((s, c) => s + c._count, 0)
  const countByStatus = Object.fromEntries(statusCounts.map((c) => [c.status, c._count]))

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">改善提案</h1>

      {/* フィルタータブ */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {FILTER_TABS.map((tab) => {
          const isActive = (status ?? '') === tab.value
          const count = tab.value === '' ? total : (countByStatus[tab.value] ?? 0)
          return (
            <Link
              key={tab.value}
              href={tab.value ? `?status=${tab.value}` : '?'}
              className={[
                'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
                isActive
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tab.label}
              {count > 0 && (
                <span className={[
                  'rounded-full px-1.5 py-0.5 text-xs',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                ].join(' ')}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? '改善提案がありません。プロンプト詳細ページから生成できます。'
            : 'このステータスの提案はありません。'}
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
