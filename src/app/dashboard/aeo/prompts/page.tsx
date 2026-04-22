import Link from 'next/link'
import { getAuth } from '@/lib/auth/get-auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listPrompts } from '@/modules/aeo'
import type { AeoEngine } from '@/generated/prisma'

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GOOGLE_AI_OVERVIEW: 'Google AIO',
}

const ENGINES: AeoEngine[] = ['CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW']

export default async function PromptsPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const prompts = await listPrompts(ctx.tenant.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">プロンプト一覧</h1>
        <Link
          href="/dashboard/aeo/prompts/new"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          + 追加
        </Link>
      </div>

      {prompts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          プロンプトがありません。「+ 追加」から作成してください。
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>プロンプト</TableHead>
              {ENGINES.map((e) => (
                <TableHead key={e}>{ENGINE_LABELS[e]}</TableHead>
              ))}
              <TableHead>最終同期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/aeo/prompts/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.text.length > 60 ? `${p.text.slice(0, 60)}…` : p.text}
                  </Link>
                  {!p.isActive && (
                    <span className="ml-2 text-xs text-muted-foreground">(無効)</span>
                  )}
                </TableCell>
                {ENGINES.map((e) => {
                  const rank = p.citationsByEngine[e]
                  return (
                    <TableCell key={e}>
                      {rank === undefined ? (
                        <Badge variant="outline">未取得</Badge>
                      ) : rank === null ? (
                        <Badge variant="destructive">未引用</Badge>
                      ) : (
                        <Badge variant="secondary">{rank}位</Badge>
                      )}
                    </TableCell>
                  )
                })}
                <TableCell className="text-xs text-muted-foreground">
                  {p.lastSyncedAt
                    ? p.lastSyncedAt.toLocaleDateString('ja-JP')
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
