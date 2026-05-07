import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: '承認キュー' }
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import ApprovalActions from './approval-actions'
import BulkActions from './bulk-actions'
import EmptyState from '@/components/empty-state'
import { CheckCircle2, Clock, TrendingUp, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

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

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED')
    return <Badge className="bg-green-600 text-white hover:bg-green-600">承認済み</Badge>
  if (status === 'REJECTED') return <Badge variant="destructive">却下</Badge>
  return <Badge variant="outline">承認待ち</Badge>
}

// payload から表示コンテンツを取り出す
function ItemPreview({ type, payload }: { type: string; payload: unknown }) {
  const p = payload as Record<string, string>

  if (type === 'aeo_suggestion') {
    return (
      <div className="space-y-1">
        {p.prompt && (
          <p className="text-xs font-medium text-muted-foreground">
            プロンプト: {p.prompt}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap line-clamp-4">{p.suggestion}</p>
      </div>
    )
  }

  if (type === 'seo_article_draft') {
    return (
      <div className="space-y-1">
        {p.keyword && (
          <p className="text-xs font-medium text-muted-foreground">
            キーワード: {p.keyword}
          </p>
        )}
        <p className="text-sm font-medium">{p.title}</p>
        <p className="text-sm text-muted-foreground line-clamp-3">{p.brief}</p>
      </div>
    )
  }

  if (type === 'nurturing_email_draft') {
    return (
      <div className="space-y-1">
        {p.segmentName && (
          <p className="text-xs font-medium text-muted-foreground">
            セグメント: {p.segmentName} / 目的: {p.goal}
          </p>
        )}
        <p className="text-sm font-medium">{p.subject}</p>
        <p className="text-sm text-muted-foreground line-clamp-3">{p.body}</p>
      </div>
    )
  }

  return <p className="text-sm text-muted-foreground">{JSON.stringify(payload)}</p>
}

// インパクトスコア計算: SEO=キーワードimpressions, nurturing=セグメントリード数, LLMO=固定50
function computeImpactScore(
  item: { module: string; type: string; payload: unknown },
  keywordImpressionsMap: Map<string, number>,
  segmentLeadCountMap: Map<string, number>,
): number {
  const p = item.payload as Record<string, string | number>

  if (item.module === 'seo') {
    const keywordText = p.keyword as string | undefined
    if (keywordText) {
      return keywordImpressionsMap.get(keywordText) ?? 10
    }
    return 10
  }

  if (item.module === 'nurturing') {
    const segmentId = p.segmentId as string | undefined
    if (segmentId) {
      return (segmentLeadCountMap.get(segmentId) ?? 1) * 5
    }
    return 5
  }

  if (item.module === 'aeo') {
    return 50
  }

  return 0
}

export default async function ApprovalQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; module?: string; page?: string; sort?: string }>
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { status, module, page: pageParam, sort } = await searchParams
  const page = parseInt(pageParam ?? '1', 10)
  const skip = (page - 1) * PAGE_SIZE
  // 'oldest' = 待機日数が長いものを先頭（優先度高）
  const sortOrder = sort === 'oldest' ? ('asc' as const) : ('desc' as const)
  const isImpactSort = sort === 'impact'

  const where = {
    tenantId: ctx.tenant.id,
    ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
    ...(module ? { module } : {}),
  }

  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const [allFetchedItems, filteredTotal, moduleCounts, statusCounts, staleCount] = await Promise.all([
    // インパクトソート時は全件取得してメモリソート
    isImpactSort
      ? prisma.approvalItem.findMany({ where, orderBy: { createdAt: 'desc' } })
      : prisma.approvalItem.findMany({
          where,
          orderBy: { createdAt: sortOrder },
          skip,
          take: PAGE_SIZE,
        }),
    prisma.approvalItem.count({ where }),
    prisma.approvalItem.groupBy({
      by: ['module'],
      where: { tenantId: ctx.tenant.id, status: 'PENDING' },
      _count: true,
    }),
    prisma.approvalItem.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, status: 'PENDING', createdAt: { lte: threeDaysAgo } },
    }),
  ])

  // インパクトソート: SEO キーワード impressions と nurturing セグメントリード数を取得
  let items = allFetchedItems
  if (isImpactSort && allFetchedItems.length > 0) {
    // SEO: payload.keyword テキストから impressions を引く
    const seoKeywordTexts = allFetchedItems
      .filter((i) => i.module === 'seo')
      .map((i) => (i.payload as Record<string, string>).keyword)
      .filter(Boolean) as string[]

    // nurturing: payload.segmentId からリード数を引く
    const segmentIds = allFetchedItems
      .filter((i) => i.module === 'nurturing')
      .map((i) => (i.payload as Record<string, string>).segmentId)
      .filter(Boolean) as string[]

    // 最新スナップショット日を取得してimpressions を引く
    const latestSnapshot = seoKeywordTexts.length > 0
      ? await prisma.seoKeywordSnapshot.findFirst({
          where: { tenantId: ctx.tenant.id },
          orderBy: { snapshotDate: 'desc' },
          select: { snapshotDate: true },
        })
      : null

    const [keywordRows, segmentRows] = await Promise.all([
      seoKeywordTexts.length > 0 && latestSnapshot
        ? prisma.seoKeywordSnapshot.findMany({
            where: {
              tenantId: ctx.tenant.id,
              snapshotDate: latestSnapshot.snapshotDate,
              keyword: { text: { in: seoKeywordTexts } },
            },
            select: { impressions: true, keyword: { select: { text: true } } },
          })
        : Promise.resolve([]),
      segmentIds.length > 0
        ? prisma.nurtureSegment.findMany({
            where: { id: { in: segmentIds }, tenantId: ctx.tenant.id },
            select: { id: true, _count: { select: { leads: true } } },
          })
        : Promise.resolve([]),
    ])

    const keywordImpressionsMap = new Map(
      (keywordRows as Array<{ impressions: number; keyword: { text: string } }>).map(
        (r) => [r.keyword.text, r.impressions],
      ),
    )
    const segmentLeadCountMap = new Map(segmentRows.map((r) => [r.id, r._count.leads]))

    items = [...allFetchedItems].sort((a, b) => {
      const scoreA = computeImpactScore(a, keywordImpressionsMap, segmentLeadCountMap)
      const scoreB = computeImpactScore(b, keywordImpressionsMap, segmentLeadCountMap)
      return scoreB - scoreA
    })

    // ページネーション適用
    items = items.slice(skip, skip + PAGE_SIZE)
  }

  const pendingByModule = Object.fromEntries(
    moduleCounts.map((r) => [r.module, r._count]),
  )
  const totalPending = moduleCounts.reduce((sum, r) => sum + r._count, 0)
  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE)

  const countByStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r._count]))
  const approvedTotal = countByStatus['APPROVED'] ?? 0
  const rejectedTotal = countByStatus['REJECTED'] ?? 0
  const decided = approvedTotal + rejectedTotal
  const approvalRate = decided > 0 ? Math.round((approvedTotal / decided) * 100) : null

  function buildHref(p: number) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (module) params.set('module', module)
    if (sort) params.set('sort', sort)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/dashboard/approval${qs ? `?${qs}` : ''}`
  }

  function sortHref(s: string) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (module) params.set('module', module)
    if (s !== 'newest') params.set('sort', s)
    const qs = params.toString()
    return `/dashboard/approval${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">承認キュー</h1>
          {totalPending > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">{totalPending} 件が承認待ち</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {approvalRate !== null && (
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className={cn(
                'h-3.5 w-3.5',
                approvalRate >= 70 ? 'text-emerald-600' : approvalRate >= 40 ? 'text-amber-600' : 'text-destructive',
              )} />
              <span className={cn(
                'font-medium',
                approvalRate >= 70 ? 'text-emerald-600' : approvalRate >= 40 ? 'text-amber-600' : 'text-destructive',
              )}>
                承認率 {approvalRate}%
              </span>
              <span className="text-muted-foreground">({approvedTotal}/{decided})</span>
            </div>
          )}
          <Link
            href="/dashboard/approval/history"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            履歴 →
          </Link>
          <BulkActions pendingCount={module ? (pendingByModule[module] ?? 0) : totalPending} module={module} />
        </div>
      </div>

      {/* フィルタバー */}
      <div className="mb-5 flex flex-wrap items-start gap-2">
        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { label: 'すべて', value: '' },
            { label: '承認待ち', value: 'PENDING' },
            { label: '承認済み', value: 'APPROVED' },
            { label: '却下', value: 'REJECTED' },
          ].map((f) => {
            const params = new URLSearchParams()
            if (f.value) params.set('status', f.value)
            if (module) params.set('module', module)
            const href = `/dashboard/approval${params.toString() ? `?${params}` : ''}`
            return (
              <a
                key={f.value}
                href={href}
                className={`rounded px-2.5 py-1 transition-colors ${
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
        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { label: '全モジュール', value: '', count: totalPending },
            { label: 'LLMO', value: 'aeo', count: pendingByModule['aeo'] ?? 0 },
            { label: 'SEO', value: 'seo', count: pendingByModule['seo'] ?? 0 },
            { label: 'ナーチャリング', value: 'nurturing', count: pendingByModule['nurturing'] ?? 0 },
          ].map((f) => {
            const params = new URLSearchParams()
            if (status) params.set('status', status)
            if (f.value) params.set('module', f.value)
            const href = `/dashboard/approval${params.toString() ? `?${params}` : ''}`
            return (
              <a
                key={f.value}
                href={href}
                className={`flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
                  (module ?? '') === f.value
                    ? 'bg-secondary text-secondary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className="rounded bg-primary/15 px-1 py-0.5 text-[10px] font-medium text-primary">
                    {f.count}
                  </span>
                )}
              </a>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { label: '最新順', value: 'newest' },
            { label: '待機日数順', value: 'oldest' },
            { label: 'インパクト順', value: 'impact' },
          ].map((s) => (
            <a
              key={s.value}
              href={sortHref(s.value)}
              className={`rounded px-2.5 py-1 transition-colors ${
                (sort ?? 'newest') === s.value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'hover:bg-accent text-muted-foreground'
              }`}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* 長期待機アラート */}
      {staleCount > 0 && !status && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          <span>
            <strong>{staleCount} 件</strong>が 3 日以上承認待ちです。
          </span>
          <a
            href={sortHref('oldest')}
            className="ml-3 shrink-0 font-medium underline underline-offset-2 hover:opacity-80"
          >
            待機日数順で表示 →
          </a>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={status === 'PENDING' ? CheckCircle2 : Clock}
          title={status === 'PENDING' ? '承認待ちのアイテムはありません' : 'アイテムがありません'}
          description={status === 'PENDING' ? 'AI が生成したコンテンツがここに表示されます。' : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filteredTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              {filteredTotal} 件中 {skip + 1}〜{Math.min(skip + PAGE_SIZE, filteredTotal)} 件を表示
            </p>
          )}
          {items.map((item) => {
            const age = daysAgo(item.createdAt)
            const isStale = item.status === 'PENDING' && age >= 3
            return (
              <Card key={item.id} className={isStale ? 'border-amber-300/60 dark:border-amber-700/50' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {MODULE_LABELS[item.module] ?? item.module}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      {item.status === 'PENDING' && age > 0 && (
                        <span className={`text-xs font-medium ${isStale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                          {age === 0 ? '今日' : `${age}日待機`}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ItemPreview type={item.type} payload={item.payload} />
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>生成: {item.createdAt.toLocaleDateString('ja-JP')}</span>
                    {item.reviewedAt && (
                      <span>
                        {item.status === 'APPROVED' ? '承認' : '却下'}:{' '}
                        {item.reviewedAt.toLocaleDateString('ja-JP')}
                      </span>
                    )}
                  </div>
                  {item.status === 'PENDING' && (
                    <div className="mt-4 border-t border-border pt-4">
                      <ApprovalActions
                        itemId={item.id}
                        type={item.type}
                        payload={item.payload as Record<string, string>}
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
