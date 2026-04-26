import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
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
import { detectCitationGaps } from '@/modules/aeo'
import type { AeoEngine } from '@/generated/prisma'
import EmptyState from '@/components/empty-state'
import GapSuggestButton from './gap-suggest-button'
import GapSuggestAllButton from './gap-suggest-all-button'
import { AlertCircle, Settings, ShieldAlert } from 'lucide-react'

export const metadata: Metadata = { title: '引用ギャップ — AEO' }

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GOOGLE_AI_OVERVIEW: 'Google AIO',
}

export default async function GapsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const gaps = await detectCitationGaps(ctx.tenant.id, ctx.tenant.ownDomain)

  // Aggregate competitor domain frequency
  const domainCounts: Record<string, number> = {}
  for (const g of gaps) {
    domainCounts[g.competitorDomain] = (domainCounts[g.competitorDomain] ?? 0) + 1
  }
  const topCompetitors = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const uniquePrompts = new Set(gaps.map((g) => g.promptId)).size
  const engineCounts: Partial<Record<AeoEngine, number>> = {}
  for (const g of gaps) {
    engineCounts[g.engine] = (engineCounts[g.engine] ?? 0) + 1
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">引用ギャップ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            競合が引用されているが自社が引用されていないケース
          </p>
        </div>
        {gaps.length > 0 && (
          <div className="shrink-0">
            <GapSuggestAllButton promptIds={gaps.map((g) => g.promptId)} />
          </div>
        )}
      </div>

      {gaps.length > 0 && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div className="flex flex-wrap items-start gap-6 text-sm">
            <div>
              <div className="flex items-center gap-1.5 text-destructive mb-0.5">
                <ShieldAlert className="h-4 w-4" />
                <span className="font-medium">{gaps.length} 件のギャップ</span>
              </div>
              <p className="text-xs text-muted-foreground">{uniquePrompts} プロンプトで未引用</p>
            </div>
            {topCompetitors.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">頻出競合ドメイン</p>
                <div className="flex flex-wrap gap-1.5">
                  {topCompetitors.map(([domain, count]) => (
                    <span key={domain} className="inline-flex items-center gap-1 rounded-full border border-destructive/30 px-2 py-0.5 text-xs font-mono">
                      {domain}
                      <span className="font-sans text-muted-foreground">×{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(engineCounts).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">エンジン別</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(engineCounts).map(([engine, count]) => (
                    <span key={engine} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {ENGINE_LABELS[engine as AeoEngine]}
                      <span className="text-muted-foreground">×{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!ctx.tenant.ownDomain && (
        <div className="mb-6 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/50 dark:text-amber-300">
          自社ドメインが設定されていません。ギャップ検出には自社ドメインが必要です。
          <Link href="/dashboard/settings" className="ml-1 font-medium underline underline-offset-2 hover:opacity-80">
            設定ページ
          </Link>
          から設定してください。
        </div>
      )}

      {gaps.length === 0 ? (
        <EmptyState
          icon={ctx.tenant.ownDomain ? AlertCircle : Settings}
          title={ctx.tenant.ownDomain ? 'ギャップが見つかりません' : '自社ドメインを設定してください'}
          description={ctx.tenant.ownDomain
            ? 'プロンプト同期を実行するとギャップが検出されます。'
            : 'ドメインを設定してからプロンプトを同期してください。'}
          action={!ctx.tenant.ownDomain ? (
            <Link href="/dashboard/settings" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              設定へ
            </Link>
          ) : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>プロンプト</TableHead>
              <TableHead>エンジン</TableHead>
              <TableHead>競合ドメイン</TableHead>
              <TableHead>競合順位</TableHead>
              <TableHead>日付</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gaps.map((g) => (
              <TableRow key={`${g.promptId}-${g.engine}-${g.competitorDomain}`}>
                <TableCell className="max-w-xs">
                  <Link
                    href={`/dashboard/aeo/prompts/${g.promptId}`}
                    className="hover:underline font-medium"
                  >
                    {g.promptText.length > 50
                      ? `${g.promptText.slice(0, 50)}…`
                      : g.promptText}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ENGINE_LABELS[g.engine]}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{g.competitorDomain}</TableCell>
                <TableCell className="tabular-nums">{g.competitorRank}位</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {g.snapshotDate.toISOString().slice(0, 10)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <GapSuggestButton promptId={g.promptId} />
                    <Link
                      href={`/dashboard/aeo/prompts/${g.promptId}`}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      詳細
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
