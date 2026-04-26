import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getPrompt, getSnapshotsForPrompt } from '@/modules/aeo'
import type { AeoEngine } from '@/generated/prisma'
import SuggestButton from './suggest-button'
import CompetitorManager from './competitor-manager'
import DeletePromptButton from './delete-prompt-button'
import Sparkline from '@/components/sparkline'

type Props = { params: Promise<{ promptId: string }> }

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GOOGLE_AI_OVERVIEW: 'Google AIO',
}

export default async function PromptDetailPage({ params }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { promptId } = await params
  const [prompt, snapshots] = await Promise.all([
    getPrompt(ctx.tenant.id, promptId),
    getSnapshotsForPrompt(ctx.tenant.id, promptId, 30),
  ])

  if (!prompt) notFound()

  // 最新の各エンジン引用状況を取得
  const ENGINES: AeoEngine[] = ['CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW']
  const latestByEngine: Partial<Record<AeoEngine, number | null>> = {}
  for (const engine of ENGINES) {
    const latest = snapshots
      .filter((s) => s.engine === engine)
      .sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime())[0]
    if (latest !== undefined) latestByEngine[engine] = latest.ownRank
  }
  const citedEngines = ENGINES.filter((e) => latestByEngine[e] !== undefined && latestByEngine[e] !== null)
  const uncitedEngines = ENGINES.filter((e) => latestByEngine[e] !== undefined && latestByEngine[e] === null)

  // エンジン×日付でグルーピング
  const byDate = new Map<string, Partial<Record<AeoEngine, number | null>>>()
  for (const snap of snapshots) {
    const d = snap.snapshotDate.toISOString().slice(0, 10)
    if (!byDate.has(d)) byDate.set(d, {})
    byDate.get(d)![snap.engine] = snap.ownRank
  }
  const dates = [...byDate.keys()].sort().reverse().slice(0, 14)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/aeo/prompts"
            className="mb-2 -ml-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            ← 一覧
          </Link>
          <h1 className="text-xl font-semibold">{prompt.text}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {prompt.industry ?? '業界未設定'}
            {!prompt.isActive && (
              <Badge variant="outline" className="ml-2">無効</Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeletePromptButton promptId={promptId} />
          <SuggestButton promptId={promptId} />
        </div>
      </div>

      {/* 現在の引用状況サマリー */}
      {Object.keys(latestByEngine).length > 0 && (
        <div className={cn(
          'rounded-lg border px-4 py-3',
          citedEngines.length > 0
            ? 'border-emerald-300/50 bg-emerald-50/50 dark:border-emerald-700/40 dark:bg-emerald-950/30'
            : 'border-destructive/30 bg-destructive/5',
        )}>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <p className={cn(
                'font-medium',
                citedEngines.length > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
              )}>
                {citedEngines.length > 0
                  ? `${citedEngines.length} / ${Object.keys(latestByEngine).length} エンジンで引用済み`
                  : 'すべてのエンジンで未引用'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">最新スナップショット時点</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ENGINES.map((engine) => {
                if (!(engine in latestByEngine)) return null
                const rank = latestByEngine[engine]
                return (
                  <span key={engine} className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    rank !== null
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {ENGINE_LABELS[engine]}
                    {rank !== null ? `: ${rank}位` : ': 未引用'}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* エンジン別引用率トレンド */}
      {snapshots.length >= 2 && (() => {
        const engines: AeoEngine[] = ['CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW']
        const allDates = [...new Set(snapshots.map((s) => s.snapshotDate.toISOString().slice(0, 10)))].sort()
        if (allDates.length < 2) return null
        return (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              引用スコアトレンド（エンジン別）
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {engines.map((engine) => {
                const engineSnaps = snapshots
                  .filter((s) => s.engine === engine)
                  .sort((a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime())
                if (engineSnaps.length < 2) return null
                return (
                  <div key={engine} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{ENGINE_LABELS[engine]}</p>
                    <Sparkline
                      data={engineSnaps.map((s) => ({
                        label: s.snapshotDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                        value: s.ownRank !== null ? Math.max(0, 10 - s.ownRank) : 0,
                      }))}
                      height={50}
                      color="hsl(var(--primary))"
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })()}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          引用状況（直近30日）
        </h2>
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">データなし。同期を実行してください。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                {(['CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW'] as AeoEngine[]).map(
                  (e) => <TableHead key={e}>{ENGINE_LABELS[e]}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dates.map((d) => {
                const row = byDate.get(d)!
                return (
                  <TableRow key={d}>
                    <TableCell className="font-mono text-xs">{d}</TableCell>
                    {(['CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW'] as AeoEngine[]).map(
                      (e) => (
                        <TableCell key={e}>
                          {!(e in row) ? (
                            <span className="text-muted-foreground">-</span>
                          ) : row[e] === null ? (
                            <Badge variant="destructive" className="text-xs">未引用</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{row[e]}位</Badge>
                          )}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          競合ドメイン
        </h2>
        <CompetitorManager
          promptId={promptId}
          initialCompetitors={prompt.competitors.map((c) => ({
            id: c.id,
            domain: c.domain,
          }))}
        />
      </section>
    </div>
  )
}
