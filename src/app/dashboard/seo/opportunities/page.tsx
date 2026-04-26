import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/empty-state'
import { TrendingUp } from 'lucide-react'

export const metadata: Metadata = { title: '改善機会 — SEO' }
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getTopOpportunities } from '@/modules/seo'
import GenerateButton from './generate-button'

export default async function OpportunitiesPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const opportunities = await getTopOpportunities(ctx.tenant.id)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">改善機会</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        表示回数が多く、順位が 11〜30 位のキーワード（コンテンツ改善で上昇の余地あり）
      </p>

      {opportunities.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="改善機会が見つかりません"
          description="GSC を同期するとランク 11〜30 位のキーワードが表示されます。"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>キーワード</TableHead>
              <TableHead>現在順位</TableHead>
              <TableHead>表示回数</TableHead>
              <TableHead>クリック</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map((op) => (
              <TableRow key={op.keywordId}>
                <TableCell className="font-medium">{op.keyword}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">
                    {op.position.toFixed(1)}位
                  </Badge>
                </TableCell>
                <TableCell>{op.impressions.toLocaleString()}</TableCell>
                <TableCell>{op.clicks}</TableCell>
                <TableCell>{(op.ctr * 100).toFixed(1)}%</TableCell>
                <TableCell>
                  <GenerateButton keywordId={op.keywordId} keyword={op.keyword} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
