import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'メールドラフト — ナーチャリング' }
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listDrafts } from '@/modules/nurturing'
import { prisma } from '@/lib/db/client'
import EmailActions from './email-actions'
import CopyButton from '@/components/copy-button'
import EmptyState from '@/components/empty-state'
import { Mail, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

const PAGE_SIZE = 20

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED')
    return <Badge className="bg-green-600 text-white hover:bg-green-600">承認済み</Badge>
  if (status === 'REJECTED')
    return <Badge variant="destructive">却下</Badge>
  return <Badge variant="outline">承認待ち</Badge>
}

export default async function NurturingEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { status, page: pageParam } = await searchParams
  const page = parseInt(pageParam ?? '1', 10)

  const [{ drafts, total: filteredTotal }, statusCounts] = await Promise.all([
    listDrafts(ctx.tenant.id, status, page),
    prisma.nurtureEmailDraft.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenant.id },
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
    return qs ? `/dashboard/nurturing/emails?${qs}` : '/dashboard/nurturing/emails'
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">メールドラフト</h1>
      </div>

      {/* フィルタータブ */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {[
          { label: 'すべて', value: '' },
          { label: '承認待ち', value: 'PENDING' },
          { label: '承認済み', value: 'APPROVED' },
          { label: '却下', value: 'REJECTED' },
        ].map((tab) => {
          const isActive = (status ?? '') === tab.value
          const count = tab.value === '' ? total : (countByStatus[tab.value] ?? 0)
          return (
            <Link
              key={tab.value}
              href={tab.value ? `/dashboard/nurturing/emails?status=${tab.value}` : '/dashboard/nurturing/emails'}
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

      {drafts.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={total === 0 ? 'メールドラフトがありません' : 'このステータスのメールドラフトはありません'}
          description={total === 0 ? 'セグメント詳細ページから AI メールを生成できます。' : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filteredTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              {filteredTotal} 件中 {(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, filteredTotal)} 件を表示
            </p>
          )}
          {drafts.map((draft) => {
            const age = daysAgo(draft.createdAt)
            const isStale = draft.status === 'PENDING' && age >= 3
            return (
            <Card key={draft.id} className={cn(isStale && 'border-amber-300/60 dark:border-amber-700/40')}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{draft.subject}</CardTitle>
                    {draft.segment && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        セグメント: {draft.segment.name}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isStale && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        <Clock className="h-3 w-3" />
                        {age}日待機
                      </span>
                    )}
                    <StatusBadge status={draft.status} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">
                  {draft.body}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {draft.createdAt.toLocaleDateString('ja-JP')}
                  </p>
                  {draft.status === 'APPROVED' && (
                    <CopyButton
                      text={`件名: ${draft.subject}\n\n${draft.body}`}
                      label="本文をコピー"
                    />
                  )}
                </div>
                {draft.status === 'PENDING' && (
                  <div className="mt-4 border-t border-border pt-4">
                    <EmailActions
                      draftId={draft.id}
                      subject={draft.subject}
                      body={draft.body}
                    />
                  </div>
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
