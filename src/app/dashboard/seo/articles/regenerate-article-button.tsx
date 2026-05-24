'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function RegenerateArticleButton({ articleId }: { articleId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState('')

  function handleRegenerate() {
    setOpen(false)
    toast.info('再生成を開始しました。完了まで数分かかります。')

    fetch(`/api/seo/articles/${articleId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ additionalInstructions: instructions.trim() || undefined }),
    })
      .then(async (res) => {
        if (res.ok) {
          toast.success('記事の再生成が完了しました')
          router.refresh()
        } else {
          const data = await res.json().catch(() => ({}))
          toast.error(data.error ?? '再生成に失敗しました')
        }
      })
      .catch(() => toast.error('再生成に失敗しました'))

    setInstructions('')
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        再生成
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">記事を再生成</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                保存済みの分析データを再利用してドラフトを再生成します。
                追加指示があれば入力してください（省略可）。
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  追加指示（任意）
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="例: もっと具体的な事例を増やして / 比較表を追加して / 文字数を増やして"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  rows={4}
                  maxLength={2000}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {instructions.length} / 2000
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleRegenerate} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  再生成する
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
