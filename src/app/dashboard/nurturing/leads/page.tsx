import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listLeads } from '@/modules/nurturing'
import { prisma } from '@/lib/db/client'
import SyncLeadsButton from './sync-leads-button'

type Props = { searchParams: Promise<{ lifecycle?: string }> }

const LIFECYCLE_LABELS: Record<string, string> = {
  lead: 'リード',
  marketingqualifiedlead: 'MQL',
  salesqualifiedlead: 'SQL',
  opportunity: '商談',
  customer: '顧客',
}

const LIFECYCLE_TABS = [
  { value: '', label: '全リード' },
  { value: 'marketingqualifiedlead', label: 'MQL' },
  { value: 'salesqualifiedlead', label: 'SQL' },
  { value: 'opportunity', label: '商談' },
  { value: 'customer', label: '顧客' },
  { value: 'lead', label: 'リード' },
]

function IcpBadge({ score }: { score: number }) {
  if (score >= 70)
    return <Badge className="bg-green-600 text-white hover:bg-green-600">{score}</Badge>
  if (score >= 40)
    return <Badge className="bg-yellow-600 text-white hover:bg-yellow-600">{score}</Badge>
  return <Badge variant="outline">{score}</Badge>
}

export default async function NurturingLeadsPage({ searchParams }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { lifecycle } = await searchParams

  const [leads, counts] = await Promise.all([
    listLeads(ctx.tenant.id, lifecycle || undefined),
    prisma.nurtureLead.groupBy({
      by: ['lifecycle'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
  ])

  const total = counts.reduce((sum, c) => sum + c._count, 0)
  const countByLifecycle = Object.fromEntries(
    counts.map((c) => [c.lifecycle ?? '', c._count])
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">リード一覧</h1>
        <SyncLeadsButton />
      </div>

      {/* フィルタータブ */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {LIFECYCLE_TABS.map((tab) => {
          const isActive = (lifecycle ?? '') === tab.value
          const count = tab.value === '' ? total : (countByLifecycle[tab.value] ?? 0)
          return (
            <Link
              key={tab.value}
              href={tab.value ? `?lifecycle=${tab.value}` : '?'}
              className={[
                'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
                isActive
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tab.label}
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

      {leads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {total === 0
              ? 'リードがありません。「同期」ボタンで HubSpot からリードを取得してください。'
              : 'このフィルターに該当するリードはありません。'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {leads.length} 件
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead>会社</TableHead>
                  <TableHead>役職</TableHead>
                  <TableHead>ライフサイクル</TableHead>
                  <TableHead className="text-right">ICP スコア</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {[lead.lastName, lead.firstName].filter(Boolean).join(' ') || '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{lead.company ?? '-'}</TableCell>
                    <TableCell>{lead.jobTitle ?? '-'}</TableCell>
                    <TableCell>
                      {lead.lifecycle ? (
                        <Badge variant="secondary">
                          {LIFECYCLE_LABELS[lead.lifecycle] ?? lead.lifecycle}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <IcpBadge score={lead.icpScore} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
