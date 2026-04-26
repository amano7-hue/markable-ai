import Link from 'next/link'
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { prisma } from '@/lib/db/client'

interface SetupStep {
  label: string
  description: string
  href: string
  done: boolean
}

interface Props {
  tenantId: string
  ownDomain: string | null
  serankingProjectId: string | null
}

export default async function SetupChecklist({ tenantId, ownDomain, serankingProjectId }: Props) {
  const [gscConn, ga4Conn, hubspotConn] = await Promise.all([
    prisma.gscConnection.findUnique({ where: { tenantId }, select: { id: true } }),
    prisma.ga4Connection.findUnique({ where: { tenantId }, select: { id: true } }),
    prisma.hubSpotConnection.findUnique({ where: { tenantId }, select: { id: true } }),
  ])

  const steps: SetupStep[] = [
    {
      label: '自社ドメインを設定',
      description: 'AEO の引用検出に必要です',
      href: '/dashboard/settings',
      done: !!ownDomain,
    },
    {
      label: 'Seranking プロジェクトを接続',
      description: 'AI 検索ランキングの日次追跡に必要です',
      href: '/dashboard/settings',
      done: !!serankingProjectId,
    },
    {
      label: 'Google Search Console を接続',
      description: 'キーワード順位・クリックデータの取得に必要です',
      href: '/dashboard/seo/connect',
      done: !!gscConn,
    },
    {
      label: 'Google Analytics 4 を接続',
      description: 'セッション・流入経路の分析に必要です',
      href: '/dashboard/analytics/connect',
      done: !!ga4Conn,
    },
    {
      label: 'HubSpot を接続',
      description: 'リード同期・メールナーチャリングに必要です',
      href: '/dashboard/nurturing/connect',
      done: !!hubspotConn,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length

  if (allDone) return null

  return (
    <Card className="mb-8 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">初期セットアップ</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {doneCount} / {steps.length} 完了
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          各連携を設定すると Markable AI のすべての機能が使えるようになります。
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.done ? '#' : step.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              step.done
                ? 'cursor-default text-muted-foreground'
                : 'hover:bg-primary/10 cursor-pointer'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            )}
            <div className="flex-1 min-w-0">
              <span className={step.done ? 'line-through' : 'font-medium'}>{step.label}</span>
              {!step.done && (
                <p className="text-xs text-muted-foreground truncate">{step.description}</p>
              )}
            </div>
            {!step.done && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
