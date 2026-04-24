import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'アトリビューション' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAttributionFunnel, getSeoAttribution, getModuleActivity } from '@/modules/attribution'

function PositionBadge({ pos }: { pos: number | null }) {
  if (pos === null) return <span className="text-muted-foreground">-</span>
  if (pos <= 3) return <Badge className="bg-green-600 text-white hover:bg-green-600">{pos}</Badge>
  if (pos <= 10) return <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">{pos}</Badge>
  if (pos <= 30) return <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">{pos}</Badge>
  return <Badge variant="outline">{pos.toFixed(1)}</Badge>
}

export default async function AttributionPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [funnel, seoRows, activity] = await Promise.all([
    getAttributionFunnel(ctx.tenant.id),
    getSeoAttribution(ctx.tenant.id),
    getModuleActivity(ctx.tenant.id),
  ])

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold">アトリビューション</h1>

      {/* マーケティングファネル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">マーケティングファネル ({funnel.period})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-0">
            {funnel.steps.map((step, i) => {
              const maxVal = funnel.steps[0].value || 1
              const heightPct = Math.max(Math.round((step.value / maxVal) * 100), 4)
              return (
                <div key={step.label} className="flex flex-1 flex-col items-center gap-2">
                  {/* 転換率 */}
                  {step.rate !== null && (
                    <span className="text-xs text-muted-foreground">↓ {step.rate}%</span>
                  )}
                  {step.rate === null && i > 0 && (
                    <span className="text-xs text-muted-foreground invisible">↓</span>
                  )}
                  {/* バー */}
                  <div
                    className="w-full rounded-t-sm bg-primary/80"
                    style={{ height: `${heightPct * 1.2}px` }}
                  />
                  {/* 数値 */}
                  <p className="text-sm font-bold">{step.value.toLocaleString()}</p>
                  {/* ラベル */}
                  <p className="text-center text-xs text-muted-foreground leading-tight">
                    {step.label}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* SEO キーワード × クリック */}
      {seoRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SEO キーワード パフォーマンス（直近 30 日）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">キーワード</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">順位</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">クリック</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">表示</th>
                </tr>
              </thead>
              <tbody>
                {seoRows.map((row) => (
                  <tr key={row.keyword} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2 font-medium">{row.keyword}</td>
                    <td className="px-4 py-2 text-right">
                      <PositionBadge pos={row.latestPosition} />
                    </td>
                    <td className="px-4 py-2 text-right">{row.clicks30d.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{row.impressions30d.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* モジュール活動サマリー */}
      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">モジュール活動サマリー</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">モジュール</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">総生成</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">承認済み</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">承認待ち</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">承認率</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((mod) => {
                  const approvalRate = mod.total > 0
                    ? Math.round((mod.approved / mod.total) * 100)
                    : 0
                  return (
                    <tr key={mod.module} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-2 font-medium">{mod.label}</td>
                      <td className="px-4 py-2 text-right">{mod.total}</td>
                      <td className="px-4 py-2 text-right text-green-600">{mod.approved}</td>
                      <td className="px-4 py-2 text-right">
                        {mod.pending > 0 ? (
                          <Badge variant="outline">{mod.pending}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">{approvalRate}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
