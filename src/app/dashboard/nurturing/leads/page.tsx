import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'リード — ナーチャリング' }
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listLeads } from '@/modules/nurturing'
import { prisma } from '@/lib/db/client'
import SyncLeadsButton from './sync-leads-button'
import EmptyState from '@/components/empty-state'
import { Users, TrendingUp, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = { searchParams: Promise<{ lifecycle?: string; page?: string }> }

const LIFECYCLE_LABELS: Record<string, string> = {
  lead: 'リード',
  marketingqualifiedlead: 'MQL',
  salesqualifiedlead: 'SQL',
  opportunity: '商談',
  customer: '顧客',
}

const LIFECYCLE_TABS = [
  { value: '', label: '全リード' },
  { value: 'marketingqualifiedlead', label: 'MQL' },
  { value: 'salesqualifiedlead', label: 'SQL' },
  { value: 'opportunity', label: '商談' },
  { value: 'customer', label: '顧客' },
  { value: 'lead', label: 'リード' },
]

function IcpBadge({ score }: { score: number }) {
  if (score >= 70)
    return <Badge className="bg-green-600 text-white hover:bg-green-600">{score}</Badge>
  if (score >= 40)
    return <Badge className="bg-yellow-600 text-white hover:bg-yellow-600">{score}</Badge>
  return <Badge variant="outline">{score}</Badge>
}

export default async function NurturingLeadsPage({ searchParams }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { lifecycle, page: rawPage } = await searchParams
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1)
  const PAGE_SIZE = 50

  const [{ leads, total: filteredTotal }, counts, icpCounts, unsegmentedHigh] = await Promise.all([
    listLeads(ctx.tenant.id, lifecycle || undefined, page),
    prisma.nurtureLead.groupBy({
      by: ['lifecycle'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
    Promise.all([
      prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, icpScore: { gte: 70 } } }),
      prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, icpScore: { gte: 40, lt: 70 } } }),
      prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id, icpScore: { lt: 40 } } }),
    ]).then(([high, mid, low]) => ({ high, mid, low })),
    prisma.nurtureLead.count({
      where: { tenantId: ctx.tenant.id, icpScore: { gte: 50 }, segments: { none: {} } },
    }),
  ])

  const total = counts.reduce((sum, c) => sum + c._count, 0)
  const countByLifecycle = Object.fromEntries(
    counts.map((c) => [c.lifecycle ?? '', c._count])
  )
  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE)

  function buildHref(params: { lifecycle?: string; page?: number }) {
    const qs = new URLSearchParams()
    if (params.lifecycle) qs.set('lifecycle', params.lifecycle)
    if (params.page && params.page > 1) qs.set('page', String(params.page))
    const str = qs.toString()
    return str ? `?${str}` : '?'
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">リード一覧</h1>
        <SyncLeadsButton />
      </div>

      {/* フィルタータブ */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {LIFECYCLE_TABS.map((tab) => {
          const isActive = (lifecycle ?? '') === tab.value
          const count = tab.value === '' ? total : (countByLifecycle[tab.value] ?? 0)
          return (
            <Link
              key={tab.value}
              href={buildHref({ lifecycle: tab.value || undefined })}
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

      {/* ICP スコア分布 */}
      {total > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            icpCounts.high > 0
              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
              : 'bg-muted text-muted-foreground',
          )}>
            <TrendingUp className="h-3 w-3" />
            ハイスコア (70+): {icpCounts.high} 件
          </div>
          <div className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            icpCounts.mid > 0
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-muted text-muted-foreground',
          )}>
            <Star className="h-3 w-3" />
            ミドルスコア (40–69): {icpCounts.mid} 件
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Users className="h-3 w-3" />
            ローおよび未スコア (&lt;40): {icpCounts.low} 件
          </div>
        </div>
      )}

      {/* 未セグメント警告 */}
      {unsegmentedHigh > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          <span>
            ICP スコア 50+ のリード <strong>{unsegmentedHigh} 件</strong>がどのセグメントにも属していません。
          </span>
          <Link
            href="/dashboard/nurturing/segments/new"
            className="ml-3 shrink-0 font-medium underline underline-offset-2 hover:opacity-80"
          >
            セグメントを作成 →
          </Link>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={total === 0 ? 'リードがありません' : 'このフィルターに該当するリードはありません'}
          description={total === 0 ? '「同期」ボタンで HubSpot からリードを取得してください。' : undefined}
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {filteredTotal} 件
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead>会社</TableHead>
                  <TableHead>役職</TableHead>
                  <TableHead>ライフサイクル</TableHead>
                  <TableHead className="text-right">ICP スコア</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {[lead.lastName, lead.firstName].filter(Boolean).join(' ') || '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{lead.company ?? '-'}</TableCell>
                    <TableCell>{lead.jobTitle ?? '-'}</TableCell>
                    <TableCell>
                      {lead.lifecycle ? (
                        <Badge variant="secondary">
                          {LIFECYCLE_LABELS[lead.lifecycle] ?? lead.lifecycle}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <IcpBadge score={lead.icpScore} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={buildHref({ lifecycle: lifecycle || undefined, page: page - 1 })}
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
              href={buildHref({ lifecycle: lifecycle || undefined, page: page + 1 })}
              className="rounded-md border border-border px-3 py-1 hover:bg-accent"
            >
              次へ →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
