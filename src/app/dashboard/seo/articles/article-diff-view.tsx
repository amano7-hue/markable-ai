'use client'

import { useState } from 'react'
import { diffWords } from 'diff'
import { Button } from '@/components/ui/button'
import { GitCompare, Loader2 } from 'lucide-react'

/** HTML タグ・エンティティを除去してプレーンテキストに変換 */
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

type DiffData = {
  sourceContent: string
  rewriteReasons: string[]
  draft: string
}

type Props = {
  articleId: string
}

export default function ArticleDiffView({ articleId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DiffData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    if (open) { setOpen(false); return }
    if (data) { setOpen(true); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}/diff`)
      if (!res.ok) { setError('差分データの取得に失敗しました'); return }
      const json = await res.json() as { data: DiffData }
      setData(json.data)
      setOpen(true)
    } catch {
      setError('差分データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const diffParts = data
    ? diffWords(stripHtml(data.sourceContent), stripHtml(data.draft))
    : []

  const stats = diffParts.reduce(
    (acc, part) => {
      const words = part.value.trim().split(/\s+/).filter(Boolean).length
      if (part.added) acc.added += words
      else if (part.removed) acc.removed += words
      return acc
    },
    { added: 0, removed: 0 },
  )

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        className="gap-1.5"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <GitCompare className="h-3.5 w-3.5" />}
        {open ? '差分を閉じる' : '差分を表示'}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {open && data && (
        <div className="rounded-md border border-border bg-muted/30 p-4 space-y-4">
          {data.rewriteReasons.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">リライト理由</p>
              <ul className="space-y-1">
                {data.rewriteReasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                    <span className="mt-0.5 shrink-0 text-muted-foreground">·</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/80" />
              追加 {stats.added} 語
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400/80" />
              削除 {stats.removed} 語
            </span>
          </div>
          <div className="max-h-[500px] overflow-auto text-sm leading-relaxed">
            {diffParts.map((part, i) => {
              if (part.added) {
                return (
                  <mark key={i} className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 rounded-sm px-0.5">
                    {part.value}
                  </mark>
                )
              }
              if (part.removed) {
                return (
                  <del key={i} className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-sm px-0.5 line-through">
                    {part.value}
                  </del>
                )
              }
              return <span key={i}>{part.value}</span>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
