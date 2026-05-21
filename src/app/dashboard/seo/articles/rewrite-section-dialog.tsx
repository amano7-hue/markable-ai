'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, PenLine, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

type Section = {
  h2: string
  html: string
  beforeContext: string
  afterContext: string
}

type Props = {
  articleId: string
  sections: Section[]
  onApply: (sectionH2: string, rewrittenHtml: string) => void
}

export default function RewriteSectionDialog({ articleId, sections, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  if (sections.length === 0) return null

  async function handleRewrite() {
    if (selectedIndex === null) return
    const sec = sections[selectedIndex]
    setLoading(true)
    setPreviewHtml(null)

    try {
      const res = await fetch(`/api/seo/articles/${articleId}/rewrite-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionH2: sec.h2,
          sectionHtml: sec.html,
          beforeContext: sec.beforeContext,
          afterContext: sec.afterContext,
          instructions: instructions.trim() || undefined,
        }),
      })
      const data = await res.json() as { rewrittenHtml?: string; error?: string }
      if (!res.ok || !data.rewrittenHtml) throw new Error(data.error ?? 'リライトに失敗しました')
      setPreviewHtml(data.rewrittenHtml)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'リライトに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (selectedIndex === null || !previewHtml) return
    const sec = sections[selectedIndex]
    onApply(sec.h2, previewHtml)
    setOpen(false)
    setPreviewHtml(null)
    setInstructions('')
    setSelectedIndex(null)
    toast.success('セクションを更新しました')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title="セクション別リライト"
      >
        <PenLine className="h-3.5 w-3.5" />
        セクション別リライト
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
            <div className="sticky top-0 border-b border-border bg-background px-5 py-4">
              <h2 className="font-semibold">セクション別リライト</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                リライトするH2セクションを選択し、指示を入力してください
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* セクション選択 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">リライト対象セクション</Label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto rounded-lg border border-border p-2">
                  {sections.map((sec, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSelectedIndex(i); setPreviewHtml(null) }}
                      className={[
                        'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                        selectedIndex === i
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted',
                      ].join(' ')}
                    >
                      {sec.h2}
                    </button>
                  ))}
                </div>
              </div>

              {/* リライト指示 */}
              <div className="space-y-2">
                <Label htmlFor="instructions" className="text-sm font-medium">
                  リライト指示
                  <span className="ml-1 text-muted-foreground font-normal">（任意）</span>
                </Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="例: より専門的なトーンに変更してほしい / 統計データを追加してほしい / 箇条書きを増やしてほしい"
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              {/* プレビュー */}
              {previewHtml && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      リライト結果プレビュー
                    </Label>
                  </div>
                  <div
                    className="prose prose-sm max-w-none rounded-lg border border-emerald-300/60 bg-emerald-50/50 p-4 dark:border-emerald-700/40 dark:bg-emerald-950/20 text-sm"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              )}

              {/* ボタン */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                >
                  キャンセル
                </Button>
                {previewHtml ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRewrite}
                      disabled={selectedIndex === null || loading}
                      className="flex-shrink-0"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '再生成'}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleApply}
                      className="flex-1"
                    >
                      この内容で反映
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={handleRewrite}
                    disabled={selectedIndex === null || loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        リライト中...
                      </>
                    ) : (
                      <>
                        <PenLine className="mr-2 h-4 w-4" />
                        リライト実行
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── HTML → セクション分割ユーティリティ ─────────────────────────

/** 記事HTMLをH2単位のセクションに分割する */
export function splitArticleIntoSections(html: string): Section[] {
  // H2タグで分割
  const parts = html.split(/(?=<h2[\s>])/i)
  const sections: Section[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part) continue

    // H2テキストを抽出
    const h2Match = part.match(/<h2[^>]*>([^<]+)<\/h2>/i)
    if (!h2Match) continue

    const h2Text = h2Match[1].trim()
    const beforeContext = i > 0 ? (parts[i - 1] ?? '').slice(-500) : ''
    const afterContext = i < parts.length - 1 ? (parts[i + 1] ?? '').slice(0, 500) : ''

    sections.push({
      h2: h2Text,
      html: part,
      beforeContext,
      afterContext,
    })
  }

  return sections
}
