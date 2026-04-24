import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listSegments } from '@/modules/nurturing'

const LIFECYCLE_LABELS: Record<string, string> = {
  lead: 'リード',
  marketingqualifiedlead: 'MQL',
  salesqualifiedlead: 'SQL',
  opportunity: '商談',
  customer: '顧客',
}

export default async function NurturingSegmentsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const segments = await listSegments(ctx.tenant.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">セグメント一覧</h1>
        <Link
          href="/dashboard/nurturing/segments/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          新規作成
        </Link>
      </div>

      {segments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            セグメントがありません。「新規作成」からセグメントを作成してください。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => (
            <Link key={segment.id} href={`/dashboard/nurturing/segments/${segment.id}`}>
              <Card className="hover:bg-accent/50 transition-colors h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{segment.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {segment.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {segment.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {segment.criteria.lifecycle?.map((lc) => (
                      <Badge key={lc} variant="secondary" className="text-xs">
                        {LIFECYCLE_LABELS[lc] ?? lc}
                      </Badge>
                    ))}
                    {segment.criteria.minIcpScore !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        ICP ≥ {segment.criteria.minIcpScore}
                      </Badge>
                    )}
                    {segment.criteria.company && (
                      <Badge variant="outline" className="text-xs">
                        会社: {segment.criteria.company}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {segment.leadCount} 件のリード
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
