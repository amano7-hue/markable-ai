'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Upload, X } from 'lucide-react'

const INTENT_OPTIONS = [
  { value: '', label: '未設定' },
  { value: 'informational', label: '情報収集' },
  { value: 'commercial', label: '比較検討' },
  { value: 'navigational', label: 'ナビゲーション' },
]

export default function CsvImportButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [defaultIntent, setDefaultIntent] = useState('')
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  async function handleImport() {
    if (lines.length === 0) return
    setLoading(true)
    const res = await fetch('/api/seo/keywords/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: lines.map((text) => ({ text, intent: defaultIntent || null })),
      }),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      toast.success(`${data.data?.created ?? lines.length} 件のキーワードをインポートしました`)
      setOpen(false)
      setRaw('')
      router.refresh()
    } else {
      toast.error('インポートに失敗しました')
    }
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8"
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        一括インポート
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl mx-4">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">キーワード一括インポート</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              キーワード（1行1件）
            </label>
            <textarea
              ref={textareaRef}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[160px] font-mono"
              placeholder={'SEO対策\n競合分析\nコンテンツマーケティング'}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {lines.length > 0 ? `${lines.length} 件を認識中` : '# で始まる行はコメントとして無視されます'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              デフォルトの検索意図（intent）
            </label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={defaultIntent}
              onChange={(e) => setDefaultIntent(e.target.value)}
            >
              {INTENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={loading || lines.length === 0}
            >
              {loading ? 'インポート中...' : `${lines.length} 件をインポート`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
