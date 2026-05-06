import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'API 使用状況 — 設定' }
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import { AlertCircle, BarChart2, ChevronLeft, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// Seranking AIRT: 1 credit/prompt/day (estimated)
// Leaderboard: 7,500 credits/call (per spec)
const MONTHLY_CREDIT_BUDGET = 10_000

function formatCredits(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default async function UsagePage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const [thisMonthLogs, lastMonthLogs, allTimeLogs, recentLogs] = await Promise.all([
    prisma.serankingApiLog.aggregate({
      where: { tenantId: ctx.tenant.id, createdAt: { gte: startOfMonth } },
      _sum: { creditsUsed: true, promptCount: true },
      _count: true,
    }),
    prisma.serankingApiLog.aggregate({
      where: { tenantId: ctx.tenant.id, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { creditsUsed: true },
      _count: true,
    }),
    prisma.serankingApiLog.aggregate({
      where: { tenantId: ctx.tenant.id },
      _sum: { creditsUsed: true },
      _count: true,
    }),
    prisma.serankingApiLog.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    // By-day summary for current month
  ])

  const thisMonthCredits = thisMonthLogs._sum.creditsUsed ?? 0
  const lastMonthCredits = lastMonthLogs._sum.creditsUsed ?? 0
  const allTimeCredits = allTimeLogs._sum.creditsUsed ?? 0
  const thisMonthCalls = thisMonthLogs._count
  const usageRate = Math.min(100, Math.round((thisMonthCredits / MONTHLY_CREDIT_BUDGET) * 100))

  const monthDelta =
    lastMonthCredits > 0
      ? Math.round(((thisMonthCredits - lastMonthCredits) / lastMonthCredits) * 100)
      : null

  // Group by operation for this month
  const byOperation = recentLogs.reduce<Record<string, { calls: number; credits: number }>>((acc, log) => {
    if (!acc[log.operation]) acc[log.operation] = { calls: 0, credits: 0 }
    acc[log.operation].calls += 1
    acc[log.operation].credits += log.creditsUsed
    return acc
  }, {})

  const OPERATION_LABELS: Record<string, string> = {
    airt_sync: 'AIRT 日次同期',
    leaderboard: 'リーダーボード',
  }
  const OPERATION_CREDITS: Record<string, string> = {
    airt_sync: '1 credit/プロンプト',
    leaderboard: '7,500 credits/回',
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          設定に戻る
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Seranking API 使用状況</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          テナントの API クレジット消費状況を確認できます。
        </p>
      </div>

      {/* 今月のサマリー */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">今月の使用状況</CardTitle>
          <CardDescription>
            {now.getFullYear()}年 {now.getMonth() + 1}月（{startOfMonth.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 〜 現在）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* クレジットゲージ */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium">{thisMonthCredits.toLocaleString()} / {MONTHLY_CREDIT_BUDGET.toLocaleString()} credits</span>
              <span className={cn(
                'text-sm font-medium',
                usageRate >= 90 ? 'text-destructive'
                  : usageRate >= 70 ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}>
                {usageRate}% 使用
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usageRate >= 90 ? 'bg-destructive'
                    : usageRate >= 70 ? 'bg-amber-500'
                    : 'bg-emerald-500',
                )}
                style={{ width: `${usageRate}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              目安: {MONTHLY_CREDIT_BUDGET.toLocaleString()} credits/月（設定変更は管理者にお問い合わせください）
            </p>
          </div>

          {usageRate >= 90 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              クレジット残量が少なくなっています。Seranking プランのアップグレードを検討してください。
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatCredits(thisMonthCredits)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">今月の消費 credits</p>
              {monthDelta !== null && (
                <p className={cn(
                  'mt-0.5 flex items-center gap-0.5 text-xs font-medium',
                  monthDelta > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
                )}>
                  {monthDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {monthDelta > 0 ? `+${monthDelta}%` : `${monthDelta}%`} 先月比
                </p>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{thisMonthCalls}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">今月の API 呼び出し</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {thisMonthLogs._sum.promptCount ?? 0} プロンプト処理
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatCredits(allTimeCredits)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">累計 credits</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {allTimeLogs._count} 回呼び出し
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作別内訳 */}
      {Object.keys(byOperation).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              操作別内訳（直近 30 件）
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {Object.entries(byOperation).map(([op, stat]) => (
                <li key={op} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{OPERATION_LABELS[op] ?? op}</p>
                    <p className="text-xs text-muted-foreground">{OPERATION_CREDITS[op] ?? '不明'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{stat.credits.toLocaleString()} credits</p>
                    <p className="text-xs text-muted-foreground">{stat.calls} 回</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 直近の API ログ */}
      {recentLogs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">直近の API 呼び出し</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">操作</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">プロンプト数</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Credits</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">日時</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">{OPERATION_LABELS[log.operation] ?? log.operation}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {log.promptCount ?? '-'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {log.creditsUsed.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                        {log.createdAt.toLocaleDateString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <p>API 呼び出し履歴がありません。</p>
            <p className="mt-1 text-xs">LLMO プロンプトを同期すると記録されます。</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
