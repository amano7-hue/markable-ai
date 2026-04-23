import Link from 'next/link'
import { getAuth } from '@/lib/auth/get-auth'
import { redirect } from 'next/navigation'
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
import { prisma } from '@/lib/db/client'
import type { AeoEngine } from '@/generated/prisma'
import SyncAeoButton from './sync-aeo-button'

type Props = { searchParams: Promise<{ industry?: string }> }

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GOOGLE_AI_OVERVIEW: 'Google AIO',
}

const ENGINES: AeoEngine[] = ['CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW']

export default async function PromptsPage({ searchParams }: Props) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const { industry } = await searchParams

  const [prompts, industryCounts] = await Promise.all([
    listPrompts(ctx.tenant.id, industry || undefined),
    prisma.aeoPrompt.groupBy({
      by: ['industry'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
  ])

  const total = industryCounts.reduce((s, c) => s + c._count, 0)
  const countByIndustry = Object.fromEntries(
    industryCounts.map((c) => [c.industry ?? '', c._count])
  )

  // Collect distinct non-null industry values for tabs
  const industries = industryCounts
    .map((c) => c.industry)
    .filter((v): v is string => v !== null && v !== '')
    .sort()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">プロンプト一覧</h1>
        <div className="flex items-center gap-2">
          <SyncAeoButton />
          <Link
            href="/dashboard/aeo/prompts/from-templates"
            className="inline-flex h-8 items-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            テンプレートから追加
          </Link>
          <Link
            href="/dashboard/aeo/prompts/new"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            + 追加
          </Link>
        </div>
      </div>

      {/* 業界フィルタータブ */}
      {industries.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
          <Link
            href="?"
            className={[
              'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
              !industry
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            すべて
            <span className={[
              'rounded-full px-1.5 py-0.5 text-xs',
              !industry ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            ].join(' ')}>
              {total}
            </span>
          </Link>
          {industries.map((ind) => {
            const isActive = industry === ind
            const count = countByIndustry[ind] ?? 0
            return (
              <Link
                key={ind}
                href={`?industry=${encodeURIComponent(ind)}`}
                className={[
                  'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
                  isActive
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {ind}
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
      )}

      {prompts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {total === 0
            ? 'プロンプトがありません。「+ 追加」から作成してください。'
            : 'この業界のプロンプトはありません。'}
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
                  {p.industry && (
                    <span className="ml-2 text-xs text-muted-foreground">{p.industry}</span>
                  )}
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
