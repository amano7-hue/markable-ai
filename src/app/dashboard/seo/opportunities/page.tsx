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
import GenerateAllButton from './generate-all-button'

export default async function OpportunitiesPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const opportunities = await getTopOpportunities(ctx.tenant.id)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">改善機会</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            表示回数が多く、順位が 11〜30 位のキーワード（コンテンツ改善で上昇の余地あり）
          </p>
        </div>
        {opportunities.length > 0 && (
          <div className="shrink-0">
            <GenerateAllButton
              opportunities={opportunities.map((op) => ({
                keywordId: op.keywordId,
                keyword: op.keyword,
              }))}
            />
          </div>
        )}
      </div>

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
