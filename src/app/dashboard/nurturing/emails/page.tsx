import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listDrafts } from '@/modules/nurturing'
import EmailActions from './email-actions'

const STATUS_LABELS: Record<string, string> = {
  PENDING: '承認待ち',
  APPROVED: '承認済み',
  REJECTED: '却下',
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED')
    return <Badge className="bg-green-600 text-white hover:bg-green-600">承認済み</Badge>
  if (status === 'REJECTED')
    return <Badge variant="destructive">却下</Badge>
  return <Badge variant="outline">承認待ち</Badge>
}

export default async function NurturingEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { status } = await searchParams
  const drafts = await listDrafts(ctx.tenant.id, status)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">メールドラフト</h1>
        <div className="flex gap-2 text-sm">
          {[
            { label: 'すべて', value: '' },
            { label: '承認待ち', value: 'PENDING' },
            { label: '承認済み', value: 'APPROVED' },
            { label: '却下', value: 'REJECTED' },
          ].map((f) => (
            <a
              key={f.value}
              href={f.value ? `/dashboard/nurturing/emails?status=${f.value}` : '/dashboard/nurturing/emails'}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                (status ?? '') === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground'
              }`}
            >
              {f.label}
            </a>
          ))}
        </div>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            メールドラフトがありません。セグメント詳細ページから生成できます。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{draft.subject}</CardTitle>
                    {draft.segment && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        セグメント: {draft.segment.name}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={draft.status} />
                    {draft.status === 'PENDING' && <EmailActions draftId={draft.id} />}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">
                  {draft.body}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {draft.createdAt.toLocaleDateString('ja-JP')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
