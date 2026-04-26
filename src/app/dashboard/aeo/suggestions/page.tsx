import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: '改善提案 — AEO' }
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import { parseAeoSuggestionPayload } from '@/modules/aeo'
import ApproveButton from './approve-button'
import EmptyState from '@/components/empty-state'
import { Lightbulb, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

const PAGE_SIZE = 20

type Props = { searchParams: Promise<{ status?: string; page?: string }> }

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

  const { status, page: pageParam } = await searchParams
  const page = parseInt(pageParam ?? '1', 10)
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    tenantId: ctx.tenant.id,
    module: 'aeo',
    ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
  }

  const [items, filteredTotal, statusCounts] = await Promise.all([
    prisma.approvalItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.approvalItem.count({ where }),
    prisma.approvalItem.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenant.id, module: 'aeo' },
      _count: true,
    }),
  ])

  const total = statusCounts.reduce((s, c) => s + c._count, 0)
  const countByStatus = Object.fromEntries(statusCounts.map((c) => [c.status, c._count]))
  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE)

  function buildHref(p: number) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

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
        <EmptyState
          icon={Lightbulb}
          title={total === 0 ? '改善提案がありません' : 'このステータスの提案はありません'}
          description={total === 0 ? 'プロンプト詳細ページから AI 改善提案を生成できます。' : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filteredTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              {filteredTotal} 件中 {skip + 1}〜{Math.min(skip + PAGE_SIZE, filteredTotal)} 件を表示
            </p>
          )}
          {items.map((item) => {
            let payload: ReturnType<typeof parseAeoSuggestionPayload> | null = null
            try {
              payload = parseAeoSuggestionPayload(item.payload)
            } catch {
              // invalid payload
            }
            const age = daysAgo(item.createdAt)
            const isStale = item.status === 'PENDING' && age >= 3

            return (
              <Card key={item.id} className={cn(isStale && 'border-amber-300/60 dark:border-amber-700/40')}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {payload?.promptText ?? '不明なプロンプト'}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {item.createdAt.toLocaleDateString('ja-JP')}
                        </p>
                        {isStale && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            <Clock className="h-3 w-3" />
                            {age}日待機
                          </span>
                        )}
                      </div>
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
                    <ApproveButton id={item.id} suggestion={payload?.suggestion ?? ''} />
                  )}
                </CardContent>
              </Card>
            )
          })}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Link
                href={buildHref(page - 1)}
                aria-disabled={page <= 1}
                className={`text-sm px-3 py-1.5 rounded-md border ${
                  page <= 1
                    ? 'pointer-events-none opacity-40 border-transparent'
                    : 'border-border hover:bg-accent'
                }`}
              >
                ← 前のページ
              </Link>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages} ページ
              </span>
              <Link
                href={buildHref(page + 1)}
                aria-disabled={page >= totalPages}
                className={`text-sm px-3 py-1.5 rounded-md border ${
                  page >= totalPages
                    ? 'pointer-events-none opacity-40 border-transparent'
                    : 'border-border hover:bg-accent'
                }`}
              >
                次のページ →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
