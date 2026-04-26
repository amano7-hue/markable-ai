import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'セグメント — ナーチャリング' }
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listSegments } from '@/modules/nurturing'
import { prisma } from '@/lib/db/client'
import EmptyState from '@/components/empty-state'
import { Layers, Sparkles, AlertTriangle, Users, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

const LIFECYCLE_LABELS: Record<string, string> = {
  lead: 'リード',
  marketingqualifiedlead: 'MQL',
  salesqualifiedlead: 'SQL',
  opportunity: '商談',
  customer: '顧客',
}

export default async function NurturingSegmentsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [segments, draftStats] = await Promise.all([
    listSegments(ctx.tenant.id),
    prisma.nurtureEmailDraft.groupBy({
      by: ['segmentId'],
      where: { tenantId: ctx.tenant.id, segmentId: { not: null } },
      _max: { createdAt: true },
      _count: true,
    }).then((rows) => Object.fromEntries(
      rows.map((r) => [r.segmentId!, { lastAt: r._max.createdAt, total: r._count }])
    )),
  ])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">セグメント一覧</h1>
        <Link
          href="/dashboard/nurturing/segments/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          新規作成
        </Link>
      </div>

      {segments.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="セグメントがありません"
          description="「新規作成」からセグメントを作成してください。"
          action={
            <Link
              href="/dashboard/nurturing/segments/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              新規作成
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => {
            const hasLeads = segment.leadCount > 0
            const draft = draftStats[segment.id]
            const lastDraftDays = draft?.lastAt ? daysAgo(draft.lastAt) : null
            const needsEmail = hasLeads && lastDraftDays === null
            const draftStale = hasLeads && lastDraftDays !== null && lastDraftDays >= 14
            return (
              <div key={segment.id} className="flex flex-col">
                <Link href={`/dashboard/nurturing/segments/${segment.id}`} className="flex-1">
                  <Card className={cn(
                    'hover:bg-accent/50 transition-colors h-full',
                    !hasLeads && 'border-amber-300/50',
                    draftStale && 'border-amber-300/50',
                    needsEmail && 'border-primary/30',
                  )}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{segment.name}</CardTitle>
                        <span className={cn(
                          'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          hasLeads
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                        )}>
                          <Users className="h-3 w-3" />
                          {segment.leadCount}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-3">
                      {segment.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {segment.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {segment.criteria.lifecycle?.map((lc) => (
                          <Badge key={lc} variant="secondary" className="text-xs">
                            {LIFECYCLE_LABELS[lc] ?? lc}
                          </Badge>
                        ))}
                        {segment.criteria.minIcpScore !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            ICP ≥ {segment.criteria.minIcpScore}
                          </Badge>
                        )}
                        {segment.criteria.company && (
                          <Badge variant="outline" className="text-xs">
                            会社: {segment.criteria.company}
                          </Badge>
                        )}
                      </div>
                      {!hasLeads && (
                        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          リードが割り当てられていません
                        </p>
                      )}
                      {needsEmail && (
                        <p className="flex items-center gap-1 text-xs text-primary font-medium">
                          <Sparkles className="h-3 w-3" />
                          メール未生成 — 生成を推奨
                        </p>
                      )}
                      {draftStale && (
                        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          最終メール {lastDraftDays}日前 — 更新を推奨
                        </p>
                      )}
                      {draft && !draftStale && lastDraftDays !== null && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          最終メール {lastDraftDays === 0 ? '今日' : `${lastDraftDays}日前`} · 計 {draft.total}件
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
                {hasLeads && (
                  <Link
                    href={`/dashboard/nurturing/segments/${segment.id}`}
                    className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-b-md border border-t-0 border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI メールを生成
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
