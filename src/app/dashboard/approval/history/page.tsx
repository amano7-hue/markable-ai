import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { prisma } from '@/lib/db/client'
import EmptyState from '@/components/empty-state'
import { History, CheckCircle2, XCircle } from 'lucide-react'

export const metadata: Metadata = { title: '承認履歴' }

const PAGE_SIZE = 30

const MODULE_LABELS: Record<string, string> = {
  aeo: 'LLMO',
  seo: 'SEO',
  nurturing: 'ナーチャリング',
}

const TYPE_LABELS: Record<string, string> = {
  aeo_suggestion: 'LLMO 改善提案',
  seo_article_draft: '記事ドラフト',
  nurturing_email_draft: 'メールドラフト',
}

function ItemPreview({ type, payload }: { type: string; payload: unknown }) {
  const p = payload as Record<string, string>
  if (type === 'aeo_suggestion') {
    return <p className="text-sm text-muted-foreground line-clamp-2">{p.suggestion}</p>
  }
  if (type === 'seo_article_draft') {
    return (
      <div>
        <p className="text-sm font-medium">{p.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{p.brief}</p>
      </div>
    )
  }
  if (type === 'nurturing_email_draft') {
    return (
      <div>
        <p className="text-sm font-medium">{p.subject}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{p.body}</p>
      </div>
    )
  }
  return <p className="text-xs text-muted-foreground">—</p>
}

export default async function ApprovalHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; module?: string; status?: string }>
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { page: pageParam, module, status } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    tenantId: ctx.tenant.id,
    status: status === 'REJECTED'
      ? ('REJECTED' as const)
      : status === 'APPROVED'
      ? ('APPROVED' as const)
      : { in: ['APPROVED', 'REJECTED'] as ('APPROVED' | 'REJECTED')[] },
    ...(module ? { module } : {}),
  }

  const [items, total, moduleCounts, statusCounts] = await Promise.all([
    prisma.approvalItem.findMany({
      where,
      orderBy: { reviewedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.approvalItem.count({ where }),
    prisma.approvalItem.groupBy({
      by: ['module'],
      where: {
        tenantId: ctx.tenant.id,
        status: { in: ['APPROVED', 'REJECTED'] },
      },
      _count: true,
    }),
    prisma.approvalItem.groupBy({
      by: ['status'],
      where: {
        tenantId: ctx.tenant.id,
        status: { in: ['APPROVED', 'REJECTED'] },
      },
      _count: true,
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const countByModule = Object.fromEntries(moduleCounts.map((r) => [r.module, r._count]))
  const countByStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r._count]))
  const approvedCount = countByStatus['APPROVED'] ?? 0
  const rejectedCount = countByStatus['REJECTED'] ?? 0
  const decidedTotal = approvedCount + rejectedCount

  function buildHref(p: number) {
    const params = new URLSearchParams()
    if (module) params.set('module', module)
    if (status) params.set('status', status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/dashboard/approval/history${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">承認履歴</h1>
          {decidedTotal > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              承認済み {approvedCount} 件 / 却下 {rejectedCount} 件（計 {decidedTotal} 件）
            </p>
          )}
        </div>
        <Link
          href="/dashboard/approval"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 承認キューへ
        </Link>
      </div>

      {/* ステータスフィルター */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 text-sm">
          {[
            { label: 'すべて', value: '' },
            { label: '承認済み', value: 'APPROVED' },
            { label: '却下', value: 'REJECTED' },
          ].map((f) => {
            const params = new URLSearchParams()
            if (f.value) params.set('status', f.value)
            if (module) params.set('module', module)
            const href = `/dashboard/approval/history${params.toString() ? `?${params}` : ''}`
            return (
              <a
                key={f.value}
                href={href}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  (status ?? '') === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                {f.label}
              </a>
            )
          })}
        </div>
        <div className="flex gap-1 text-sm">
          {[
            { label: '全モジュール', value: '' },
            { label: 'LLMO', value: 'aeo' },
            { label: 'SEO', value: 'seo' },
            { label: 'ナーチャリング', value: 'nurturing' },
          ].map((f) => {
            const params = new URLSearchParams()
            if (status) params.set('status', status)
            if (f.value) params.set('module', f.value)
            const href = `/dashboard/approval/history${params.toString() ? `?${params}` : ''}`
            const count = f.value ? (countByModule[f.value] ?? 0) : decidedTotal
            return (
              <a
                key={f.value}
                href={href}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  (module ?? '') === f.value
                    ? 'bg-secondary text-secondary-foreground font-medium'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className="ml-1 text-xs opacity-60">{count}</span>
                )}
              </a>
            )
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={History}
          title="履歴がありません"
          description="承認または却下されたアイテムがここに表示されます。"
          action={
            <Link
              href="/dashboard/approval"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              承認キューへ
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 rounded-lg border border-border bg-card p-4"
              >
                {/* ステータスアイコン */}
                <div className="mt-0.5 shrink-0">
                  {item.status === 'APPROVED' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {MODULE_LABELS[item.module] ?? item.module}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </Badge>
                    <span
                      className={`text-xs font-medium ${
                        item.status === 'APPROVED'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive'
                      }`}
                    >
                      {item.status === 'APPROVED' ? '承認済み' : '却下'}
                    </span>
                  </div>

                  <div className="mt-2">
                    <ItemPreview type={item.type} payload={item.payload} />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {item.reviewedAt && (
                      <span>
                        決定:{' '}
                        {item.reviewedAt.toLocaleString('ja-JP', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {item.reviewedBy && <span>担当: {item.reviewedBy}</span>}
                    <span>
                      作成:{' '}
                      {item.createdAt.toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm">
              {page > 1 && (
                <Link
                  href={buildHref(page - 1)}
                  className="rounded-md border border-border px-3 py-1 hover:bg-accent"
                >
                  ← 前へ
                </Link>
              )}
              <span className="text-muted-foreground">
                {page} / {totalPages} ページ
              </span>
              {page < totalPages && (
                <Link
                  href={buildHref(page + 1)}
                  className="rounded-md border border-border px-3 py-1 hover:bg-accent"
                >
                  次へ →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
