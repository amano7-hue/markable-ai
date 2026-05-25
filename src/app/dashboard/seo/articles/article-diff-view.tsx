'use client'

import { useState, useMemo } from 'react'
import { diffWords } from 'diff'
import { Button } from '@/components/ui/button'
import { GitCompare } from 'lucide-react'

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

type Props = {
  sourceContent: string
  draft: string
}

export default function ArticleDiffView({ sourceContent, draft }: Props) {
  const [open, setOpen] = useState(false)

  const diffParts = useMemo(() => {
    const srcText = stripHtml(sourceContent)
    const draftText = stripHtml(draft)
    return diffWords(srcText, draftText)
  }, [sourceContent, draft])

  const stats = useMemo(() => {
    let added = 0, removed = 0
    for (const part of diffParts) {
      const words = part.value.trim().split(/\s+/).filter(Boolean).length
      if (part.added) added += words
      else if (part.removed) removed += words
    }
    return { added, removed }
  }, [diffParts])

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
      >
        <GitCompare className="h-3.5 w-3.5" />
        {open ? '差分を閉じる' : '差分を表示'}
      </Button>

      {open && (
        <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
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
