import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'
import ApprovalActions from './approval-actions'
import BulkActions from './bulk-actions'

const MODULE_LABELS: Record<string, string> = {
  aeo: 'AEO',
  seo: 'SEO',
  nurturing: 'ナーチャリング',
}

const TYPE_LABELS: Record<string, string> = {
  aeo_suggestion: 'AEO 改善提案',
  seo_article_draft: '記事ドラフト',
  nurturing_email_draft: 'メールドラフト',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '承認待ち',
  APPROVED: '承認済み',
  REJECTED: '却下',
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

export default async function ApprovalQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; module?: string }>
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { status, module } = await searchParams

  const [items, moduleCounts] = await Promise.all([
    prisma.approvalItem.findMany({
      where: {
        tenantId: ctx.tenant.id,
        ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
        ...(module ? { module } : {}),
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.approvalItem.groupBy({
      by: ['module'],
      where: { tenantId: ctx.tenant.id, status: 'PENDING' },
      _count: true,
    }),
  ])

  const pendingCount = items.filter((i) => i.status === 'PENDING').length
  const pendingByModule = Object.fromEntries(
    moduleCounts.map((r) => [r.module, r._count]),
  )
  const totalPending = moduleCounts.reduce((sum, r) => sum + r._count, 0)

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">承認キュー</h1>
          {totalPending > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{totalPending} 件が承認待ち</p>
          )}
        </div>
        <BulkActions pendingCount={module ? (pendingByModule[module] ?? 0) : totalPending} module={module} />
      </div>

      {/* フィルタバー */}
      <div className="mb-6 flex flex-wrap gap-2">
        <div className="flex gap-1 text-sm">
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
                className={`rounded-md px-3 py-1.5 transition-colors ${
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
        <div className="flex gap-1 text-sm">
          {[
            { label: '全モジュール', value: '', count: totalPending },
            { label: 'AEO', value: 'aeo', count: pendingByModule['aeo'] ?? 0 },
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
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                  (module ?? '') === f.value
                    ? 'bg-secondary text-secondary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                    {f.count}
                  </span>
                )}
              </a>
            )
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {status === 'PENDING'
              ? '承認待ちのアイテムはありません。'
              : 'アイテムがありません。'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {MODULE_LABELS[item.module] ?? item.module}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.status === 'PENDING' && <ApprovalActions itemId={item.id} />}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ItemPreview type={item.type} payload={item.payload} />
                <p className="mt-3 text-xs text-muted-foreground">
                  {item.createdAt.toLocaleDateString('ja-JP')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
