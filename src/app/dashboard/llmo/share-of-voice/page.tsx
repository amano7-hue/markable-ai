import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/empty-state'
import { BarChart2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AeoEngine } from '@/generated/prisma'

export const metadata: Metadata = { title: 'Share of Voice — LLMO' }

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GOOGLE_AI_OVERVIEW: 'Google AIO',
}

interface DomainSov {
  domain: string
  isOwn: boolean
  citedCount: number
  totalSnapshots: number
  sovPct: number
  byEngine: Record<string, { cited: number; total: number }>
}

function SovBar({ pct, isOwn }: { pct: number; isOwn: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', isOwn ? 'bg-primary' : 'bg-muted-foreground/40')}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn('text-sm tabular-nums font-medium w-10 text-right', isOwn ? 'text-primary' : 'text-muted-foreground')}>
        {pct}%
      </span>
    </div>
  )
}

export default async function ShareOfVoicePage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const ownDomain = ctx.tenant.ownDomain

  // 直近 30 日分のスナップショット
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const snapshots = await prisma.aeoRankSnapshot.findMany({
    where: { tenantId: ctx.tenant.id, snapshotDate: { gte: since } },
    select: {
      engine: true,
      snapshotDate: true,
      ownRank: true,
      citations: true,
      prompt: { select: { id: true, text: true } },
    },
    orderBy: { snapshotDate: 'desc' },
  })

  if (snapshots.length === 0) {
    return (
      <div className="max-w-3xl">
        <h1 className="mb-6 text-2xl font-semibold">Share of Voice</h1>
        <EmptyState
          icon={BarChart2}
          title="スナップショットデータがありません"
          description="プロンプトを追跡すると、自社と競合の引用率を比較できます。"
        />
      </div>
    )
  }

  // ドメイン別に集計
  const domainMap = new Map<string, { citedCount: number; totalSnapshots: number; byEngine: Record<string, { cited: number; total: number }> }>()

  const engines = [...new Set(snapshots.map((s) => s.engine))]

  function ensureDomain(domain: string) {
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        citedCount: 0,
        totalSnapshots: snapshots.length,
        byEngine: Object.fromEntries(engines.map((e) => [e, { cited: 0, total: 0 }])),
      })
    }
    return domainMap.get(domain)!
  }

  for (const snap of snapshots) {
    const cits = snap.citations as Array<{ domain: string; rank: number }>

    // 自社
    if (ownDomain) {
      const d = ensureDomain(ownDomain)
      d.byEngine[snap.engine] = d.byEngine[snap.engine] ?? { cited: 0, total: 0 }
      d.byEngine[snap.engine].total++
      if (snap.ownRank !== null) {
        d.citedCount++
        d.byEngine[snap.engine].cited++
      }
    }

    // 競合
    for (const cit of cits) {
      if (cit.domain === ownDomain) continue
      const d = ensureDomain(cit.domain)
      d.byEngine[snap.engine] = d.byEngine[snap.engine] ?? { cited: 0, total: 0 }
      d.byEngine[snap.engine].total++
      d.citedCount++
      d.byEngine[snap.engine].cited++
    }
  }

  // totalSnapshots をエンジン別に再計算（スナップショット数はエンジンで異なる可能性）
  const engineTotals = new Map<string, number>()
  for (const snap of snapshots) {
    engineTotals.set(snap.engine, (engineTotals.get(snap.engine) ?? 0) + 1)
  }
  for (const [, d] of domainMap) {
    for (const [eng, counts] of Object.entries(d.byEngine)) {
      if (counts.total === 0) counts.total = engineTotals.get(eng as AeoEngine) ?? 0
    }
    d.totalSnapshots = snapshots.length
  }

  const domains: DomainSov[] = [...domainMap.entries()]
    .map(([domain, d]) => ({
      domain,
      isOwn: domain === ownDomain,
      citedCount: d.citedCount,
      totalSnapshots: d.totalSnapshots,
      sovPct: d.totalSnapshots > 0 ? Math.round((d.citedCount / d.totalSnapshots) * 100) : 0,
      byEngine: d.byEngine,
    }))
    .sort((a, b) => {
      if (a.isOwn) return -1
      if (b.isOwn) return 1
      return b.sovPct - a.sovPct
    })

  const ownSov = domains.find((d) => d.isOwn)
  const topCompetitor = domains.find((d) => !d.isOwn)

  // プロンプト別引用率（上位 10）
  const promptMap = new Map<string, { text: string; citedEngines: Set<string>; totalEngines: number }>()
  for (const snap of snapshots) {
    if (!promptMap.has(snap.prompt.id)) {
      promptMap.set(snap.prompt.id, { text: snap.prompt.text, citedEngines: new Set(), totalEngines: 0 })
    }
    const p = promptMap.get(snap.prompt.id)!
    p.totalEngines++
    if (snap.ownRank !== null) p.citedEngines.add(snap.engine)
  }

  const promptStats = [...promptMap.entries()]
    .map(([id, p]) => ({
      id,
      text: p.text,
      citedCount: p.citedEngines.size,
      totalCount: p.totalEngines,
      pct: p.totalEngines > 0 ? Math.round((p.citedEngines.size / p.totalEngines) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Share of Voice</h1>
        <p className="mt-1 text-sm text-muted-foreground">直近 30 日間のスナップショット {snapshots.length} 件を集計</p>
      </div>

      {/* 自社 vs 最大競合 サマリー */}
      {ownSov && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-primary/30">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">自社 SoV</p>
              <p className="text-3xl font-bold tabular-nums text-primary">{ownSov.sovPct}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{ownDomain}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ownSov.citedCount} / {ownSov.totalSnapshots} 件で引用</p>
            </CardContent>
          </Card>
          {topCompetitor && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-medium text-muted-foreground">最大競合 SoV</p>
                  {topCompetitor.sovPct > (ownSov?.sovPct ?? 0) && (
                    <Badge variant="destructive" className="text-xs">上回られています</Badge>
                  )}
                </div>
                <p className="text-3xl font-bold tabular-nums">{topCompetitor.sovPct}%</p>
                <p className="mt-1 text-xs text-muted-foreground truncate">{topCompetitor.domain}</p>
                <p className="mt-1 text-xs text-muted-foreground">{topCompetitor.citedCount} / {topCompetitor.totalSnapshots} 件で引用</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ドメイン別 SoV テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            ドメイン別 Share of Voice
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">ドメイン</th>
                {engines.map((e) => (
                  <th key={e} className="px-3 py-3 text-center font-medium text-muted-foreground text-xs">
                    {ENGINE_LABELS[e]}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">総合 SoV</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.domain} className={cn(
                  'border-b border-border last:border-0',
                  d.isOwn && 'bg-primary/5',
                )}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-medium truncate max-w-[200px]', d.isOwn && 'text-primary')}>
                        {d.domain}
                      </span>
                      {d.isOwn && <Badge className="text-xs bg-primary/20 text-primary hover:bg-primary/20">自社</Badge>}
                    </div>
                  </td>
                  {engines.map((e) => {
                    const eng = d.byEngine[e] ?? { cited: 0, total: 0 }
                    const pct = eng.total > 0 ? Math.round((eng.cited / eng.total) * 100) : 0
                    return (
                      <td key={e} className="px-3 py-3 text-center">
                        <span className={cn(
                          'text-sm font-medium tabular-nums',
                          pct >= 50 ? 'text-emerald-600 dark:text-emerald-400'
                            : pct >= 20 ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground',
                        )}>
                          {pct}%
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3">
                    <SovBar pct={d.sovPct} isOwn={d.isOwn} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* プロンプト別 自社引用率 */}
      {ownDomain && promptStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">プロンプト別 自社引用率（上位 10）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">プロンプト</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">引用率</th>
                </tr>
              </thead>
              <tbody>
                {promptStats.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2 max-w-xs truncate">{p.text}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', p.pct >= 50 ? 'bg-emerald-500' : p.pct >= 20 ? 'bg-amber-500' : 'bg-destructive')}
                            style={{ width: `${p.pct}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-sm font-medium tabular-nums w-10 text-right',
                          p.pct >= 50 ? 'text-emerald-600 dark:text-emerald-400'
                            : p.pct >= 20 ? 'text-amber-600 dark:text-amber-400'
                            : 'text-destructive',
                        )}>
                          {p.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
