import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
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
import { getSegment } from '@/modules/nurturing'
import type { SegmentCriteria } from '@/modules/nurturing/types'
import GenerateEmailButton from './generate-email-button'
import DeleteSegmentButton from './delete-segment-button'
import ApplySegmentButton from './apply-segment-button'

const LIFECYCLE_LABELS: Record<string, string> = {
  lead: 'リード',
  marketingqualifiedlead: 'MQL',
  salesqualifiedlead: 'SQL',
  opportunity: '商談',
  customer: '顧客',
}

type Params = { params: Promise<{ segmentId: string }> }

export default async function SegmentDetailPage({ params }: Params) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { segmentId } = await params
  const segment = await getSegment(ctx.tenant.id, segmentId)
  if (!segment) notFound()

  const leads = segment.leads.map((ls) => ls.lead)
  const criteria = segment.criteria as SegmentCriteria

  return (
    <div>
      <Link
        href="/dashboard/nurturing/segments"
        className="mb-4 -ml-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← セグメント一覧
      </Link>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{segment.name}</h1>
          {segment.description && (
            <p className="mt-1 text-sm text-muted-foreground">{segment.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <ApplySegmentButton segmentId={segmentId} />
          <GenerateEmailButton segmentId={segmentId} />
          <DeleteSegmentButton segmentId={segmentId} />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {criteria.lifecycle?.map((lc) => (
          <Badge key={lc} variant="secondary">
            {lc}
          </Badge>
        ))}
        {criteria.minIcpScore !== undefined && (
          <Badge variant="outline">ICP ≥ {criteria.minIcpScore}</Badge>
        )}
        {criteria.company && (
          <Badge variant="outline">会社: {criteria.company}</Badge>
        )}
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            このセグメントに該当するリードがありません。
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {leads.length} 件のリード
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
                    <TableCell className="text-right font-medium">{lead.icpScore}</TableCell>
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
