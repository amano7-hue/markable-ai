import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { detectCitationGaps } from '@/modules/aeo'
import type { AeoEngine } from '@/generated/prisma'

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GOOGLE_AI_OVERVIEW: 'Google AIO',
}

export default async function GapsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const gaps = await detectCitationGaps(ctx.tenant.id, ctx.tenant.ownDomain)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">引用ギャップ</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        競合が引用されているが自社が引用されていないケース
      </p>

      {!ctx.tenant.ownDomain && (
        <div className="mb-6 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          自社ドメインが設定されていません。ギャップ検出には自社ドメインが必要です。
          <Link href="/dashboard/settings" className="ml-1 underline hover:opacity-80">
            設定ページ
          </Link>
          から設定してください。
        </div>
      )}

      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ctx.tenant.ownDomain
            ? 'ギャップが見つかりません。プロンプト同期を実行してください。'
            : 'ドメインを設定してから再確認してください。'}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>プロンプト</TableHead>
              <TableHead>エンジン</TableHead>
              <TableHead>競合ドメイン</TableHead>
              <TableHead>競合順位</TableHead>
              <TableHead>日付</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gaps.map((g, idx) => (
              <TableRow key={idx}>
                <TableCell className="max-w-xs">
                  <Link
                    href={`/dashboard/aeo/prompts/${g.promptId}`}
                    className="hover:underline"
                  >
                    {g.promptText.length > 50
                      ? `${g.promptText.slice(0, 50)}…`
                      : g.promptText}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ENGINE_LABELS[g.engine]}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{g.competitorDomain}</TableCell>
                <TableCell>{g.competitorRank}位</TableCell>
                <TableCell className="font-mono text-xs">
                  {g.snapshotDate.toISOString().slice(0, 10)}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dashboard/aeo/prompts/${g.promptId}`}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    詳細
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
