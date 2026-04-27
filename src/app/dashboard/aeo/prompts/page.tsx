import type { Metadata } from 'next'
import Link from 'next/link'
import { getAuth } from '@/lib/auth/get-auth'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listPrompts } from '@/modules/aeo'
import { prisma } from '@/lib/db/client'
import type { AeoEngine } from '@/generated/prisma'
import SyncAeoButton from './sync-aeo-button'
import EmptyState from '@/components/empty-state'
import { MessageSquare, Sparkles, AlertCircle } from 'lucide-react'
import PromptSuggestButton from './prompt-suggest-button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'プロンプト — AEO' }

type Props = { searchParams: Promise<{ industry?: string }> }

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GOOGLE_AI_OVERVIEW: 'Google AIO',
}

const ENGINES: AeoEngine[] = ['CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW']

export default async function PromptsPage({ searchParams }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { industry } = await searchParams

  const [prompts, industryCounts, lastSnapshot] = await Promise.all([
    listPrompts(ctx.tenant.id, industry || undefined),
    prisma.aeoPrompt.groupBy({
      by: ['industry'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
    prisma.aeoRankSnapshot.findFirst({
      where: { tenantId: ctx.tenant.id },
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    }),
  ])

  const syncDaysAgo = lastSnapshot
    ? Math.floor((Date.now() - lastSnapshot.snapshotDate.getTime()) / 86_400_000)
    : null
  const syncStale = syncDaysAgo !== null && syncDaysAgo >= 3

  const total = industryCounts.reduce((s, c) => s + c._count, 0)
  const countByIndustry = Object.fromEntries(
    industryCounts.map((c) => [c.industry ?? '', c._count])
  )

  // Collect distinct non-null industry values for tabs
  const industries = industryCounts
    .map((c) => c.industry)
    .filter((v): v is string => v !== null && v !== '')
    .sort()

  // Pending approvals for this module
  const pendingCount = await prisma.approvalItem.count({
    where: { tenantId: ctx.tenant.id, module: 'aeo', status: 'PENDING' },
  })

  // Health stats from loaded prompts
  const activePrompts = prompts.filter((p) => p.isActive)
  const citedPrompts = activePrompts.filter(
    (p) => Object.values(p.citationsByEngine).some((r) => r !== null)
  )
  const fullUncited = activePrompts.filter(
    (p) => Object.values(p.citationsByEngine).length > 0 &&
           Object.values(p.citationsByEngine).every((r) => r === null)
  )
  const citationRate = activePrompts.length > 0
    ? Math.round((citedPrompts.length / activePrompts.length) * 100)
    : null

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">プロンプト一覧</h1>
          {lastSnapshot && (
            <p className={cn('mt-0.5 text-xs', syncStale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
              最終同期: {lastSnapshot.snapshotDate.toLocaleDateString('ja-JP')}
              {syncStale && ` (${syncDaysAgo}日前 — 更新を推奨)`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SyncAeoButton />
          <Link
            href="/dashboard/aeo/prompts/from-templates"
            className="inline-flex h-8 items-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            テンプレートから追加
          </Link>
          <Link
            href="/dashboard/aeo/prompts/new"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            + 追加
          </Link>
        </div>
      </div>

      {/* AEO 同期が古い場合の警告 */}
      {syncStale && activePrompts.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>AEO データが <strong>{syncDaysAgo}日</strong> 更新されていません。「同期」ボタンで最新データを取得してください。</span>
        </div>
      )}

      {/* 引用率サマリー */}
      {activePrompts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-1.5">
            <span className={cn(
              'h-2 w-2 rounded-full',
              citationRate !== null && citationRate >= 50 ? 'bg-emerald-500' :
              citationRate !== null && citationRate >= 20 ? 'bg-amber-500' : 'bg-destructive',
            )} />
            <span className="font-medium">引用率 {citationRate ?? 0}%</span>
          </span>
          <span className="text-muted-foreground">
            引用済み: <span className="font-medium text-foreground">{citedPrompts.length}</span> / {activePrompts.length} プロンプト
          </span>
          {fullUncited.length > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              完全未引用: {fullUncited.length}件
            </span>
          )}
        </div>
      )}

      {/* 未引用かつ承認待ちなし → 一括生成 CTA */}
      {fullUncited.length >= 2 && pendingCount === 0 && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-foreground">
              {fullUncited.length} 件のプロンプトがすべてのエンジンで未引用です
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              各プロンプトの詳細ページから AI 改善提案を生成できます
            </p>
          </div>
          <Link
            href="/dashboard/aeo/suggestions"
            className="ml-4 shrink-0 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            <AlertCircle className="h-3 w-3" />
            提案を確認
          </Link>
        </div>
      )}

      {/* 業界フィルタータブ */}
      {industries.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
          <Link
            href="?"
            className={[
              'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
              !industry
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            すべて
            <span className={[
              'rounded-full px-1.5 py-0.5 text-xs',
              !industry ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            ].join(' ')}>
              {total}
            </span>
          </Link>
          {industries.map((ind) => {
            const isActive = industry === ind
            const count = countByIndustry[ind] ?? 0
            return (
              <Link
                key={ind}
                href={`?industry=${encodeURIComponent(ind)}`}
                className={[
                  'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
                  isActive
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {ind}
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
      )}

      {prompts.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={total === 0 ? 'プロンプトがありません' : 'この業界のプロンプトはありません'}
          description={total === 0 ? '「+ 追加」またはテンプレートからプロンプトを作成してください。' : undefined}
          action={total === 0 ? (
            <div className="flex gap-2">
              <Link href="/dashboard/aeo/prompts/from-templates" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                テンプレートから追加
              </Link>
              <Link href="/dashboard/aeo/prompts/new" className={buttonVariants({ size: 'sm' })}>
                + 追加
              </Link>
            </div>
          ) : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>プロンプト</TableHead>
              {ENGINES.map((e) => (
                <TableHead key={e}>{ENGINE_LABELS[e]}</TableHead>
              ))}
              <TableHead>最終同期</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/aeo/prompts/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.text.length > 60 ? `${p.text.slice(0, 60)}…` : p.text}
                  </Link>
                  {p.industry && (
                    <span className="ml-2 text-xs text-muted-foreground">{p.industry}</span>
                  )}
                  {!p.isActive && (
                    <span className="ml-2 text-xs text-muted-foreground">(無効)</span>
                  )}
                </TableCell>
                {ENGINES.map((e) => {
                  const rank = p.citationsByEngine[e]
                  return (
                    <TableCell key={e}>
                      {rank === undefined ? (
                        <Badge variant="outline">未取得</Badge>
                      ) : rank === null ? (
                        <Badge variant="destructive">未引用</Badge>
                      ) : (
                        <Badge variant="secondary">{rank}位</Badge>
                      )}
                    </TableCell>
                  )
                })}
                <TableCell className="text-xs text-muted-foreground">
                  {p.lastSyncedAt
                    ? p.lastSyncedAt.toLocaleDateString('ja-JP')
                    : '-'}
                </TableCell>
                <TableCell>
                  {p.isActive && Object.values(p.citationsByEngine).every((r) => r === null) && (
                    <PromptSuggestButton promptId={p.id} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
