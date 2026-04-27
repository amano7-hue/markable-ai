import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
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
import { getSegment } from '@/modules/nurturing'
import type { SegmentCriteria } from '@/modules/nurturing/types'
import { prisma } from '@/lib/db/client'
import GenerateEmailButton from './generate-email-button'
import DeleteSegmentButton from './delete-segment-button'
import ApplySegmentButton from './apply-segment-button'
import EmptyState from '@/components/empty-state'
import { Users, TrendingUp, Mail, Clock, Sparkles, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const LIFECYCLE_LABELS: Record<string, string> = {
  lead: 'リード',
  marketingqualifiedlead: 'MQL',
  salesqualifiedlead: 'SQL',
  opportunity: '商談',
  customer: '顧客',
}

type Params = { params: Promise<{ segmentId: string }> }

export default async function SegmentDetailPage({ params }: Params) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { segmentId } = await params
  const [segment, icpAgg, lastDraft] = await Promise.all([
    getSegment(ctx.tenant.id, segmentId),
    prisma.nurtureLead.aggregate({
      where: {
        tenantId: ctx.tenant.id,
        segments: { some: { segmentId } },
      },
      _avg: { icpScore: true },
      _max: { icpScore: true },
      _min: { icpScore: true },
    }),
    prisma.nurtureEmailDraft.findFirst({
      where: { tenantId: ctx.tenant.id, segmentId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true },
    }),
  ])
  if (!segment) notFound()

  const leads = segment.leads.map((ls) => ls.lead)
  const criteria = segment.criteria as SegmentCriteria

  const avgIcp = icpAgg._avg.icpScore !== null ? Math.round(icpAgg._avg.icpScore ?? 0) : null
  const highScoreCount = leads.filter((l) => l.icpScore >= 50).length
  const lastDraftDaysAgo = lastDraft
    ? Math.floor((Date.now() - lastDraft.createdAt.getTime()) / 86_400_000)
    : null
  const emailStale = lastDraftDaysAgo !== null && lastDraftDaysAgo >= 14

  return (
    <div>
      <Link
        href="/dashboard/nurturing/segments"
        className="mb-4 -ml-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← セグメント一覧
      </Link>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{segment.name}</h1>
          {segment.description && (
            <p className="mt-1 text-sm text-muted-foreground">{segment.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <ApplySegmentButton segmentId={segmentId} />
          <GenerateEmailButton segmentId={segmentId} />
          <DeleteSegmentButton segmentId={segmentId} />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {criteria.lifecycle?.map((lc) => (
          <Badge key={lc} variant="secondary">
            {LIFECYCLE_LABELS[lc] ?? lc}
          </Badge>
        ))}
        {criteria.minIcpScore !== undefined && (
          <Badge variant="outline">ICP ≥ {criteria.minIcpScore}</Badge>
        )}
        {criteria.company && (
          <Badge variant="outline">会社: {criteria.company}</Badge>
        )}
      </div>

      {/* セグメントスタッツ */}
      {leads.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <Users className="mb-1 h-4 w-4 text-muted-foreground" />
            <p className="text-xl font-bold tabular-nums">{leads.length}</p>
            <p className="text-xs text-muted-foreground">リード数</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <TrendingUp className={cn('mb-1 h-4 w-4', avgIcp !== null && avgIcp >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
            <p className={cn('text-xl font-bold tabular-nums', avgIcp !== null && avgIcp >= 50 ? 'text-emerald-600 dark:text-emerald-400' : '')}>
              {avgIcp ?? '-'}
            </p>
            <p className="text-xs text-muted-foreground">平均 ICP スコア</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <TrendingUp className={cn('mb-1 h-4 w-4', highScoreCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
            <p className={cn('text-xl font-bold tabular-nums', highScoreCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : '')}>
              {highScoreCount}
            </p>
            <p className="text-xs text-muted-foreground">スコア 50+ 件</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <Mail className={cn('mb-1 h-4 w-4', lastDraft ? 'text-primary' : 'text-muted-foreground')} />
            <p className="text-xl font-bold tabular-nums">
              {lastDraft ? (
                <span className={cn(
                  'text-base',
                  lastDraft.status === 'PENDING' ? 'text-amber-600 dark:text-amber-400' :
                  lastDraft.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-400' :
                  'text-muted-foreground'
                )}>
                  {lastDraft.status === 'PENDING' ? '承認待ち' : lastDraft.status === 'APPROVED' ? '承認済み' : '却下'}
                </span>
              ) : '-'}
            </p>
            <p className="text-xs text-muted-foreground">
              {lastDraft ? `最終メール: ${lastDraft.createdAt.toLocaleDateString('ja-JP')}` : 'メール未生成'}
            </p>
          </div>
        </div>
      )}

      {/* メール生成 CTA */}
      {leads.length > 0 && !lastDraft && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-foreground">
              このセグメントにはまだメールが生成されていません
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {highScoreCount > 0 && `ICP スコア 50+ のリードが ${highScoreCount} 件 — `}AI がナーチャリングメールを自動生成します
            </p>
          </div>
          <div className="ml-4 shrink-0">
            <GenerateEmailButton segmentId={segmentId} />
          </div>
        </div>
      )}

      {/* メール更新推奨 */}
      {leads.length > 0 && emailStale && lastDraft?.status !== 'PENDING' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>最終メールから <strong>{lastDraftDaysAgo}日</strong> 経過しています。新しいメールの生成を検討してください。</span>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="このセグメントに該当するリードがありません"
          description="「criteria を適用」ボタンでセグメント条件を再評価してください。"
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {leads.length} 件のリード
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
                    <TableCell className="text-right font-medium">{lead.icpScore}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
