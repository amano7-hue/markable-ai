'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles } from 'lucide-react'

type Keyword = {
  id: string
  text: string
  position: number | null
}

type Props = {
  keywords: Keyword[]
}

export default function NewArticleForm({ keywords }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'select' | 'free'>('free')
  const [keywordId, setKeywordId] = useState('')
  const [keywordText, setKeywordText] = useState('')
  const [title, setTitle] = useState('')
  const [ownInsights, setOwnInsights] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedKeyword = keywords.find((k) => k.id === keywordId)

  // キーワード選択時にタイトルを自動補完
  function handleKeywordSelect(id: string) {
    setKeywordId(id)
    const kw = keywords.find((k) => k.id === id)
    if (kw && !title) setTitle(`${kw.text}とは？`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const kw = mode === 'select' ? keywordId : keywordText.trim()
    if (!kw) { setError('キーワードを入力してください'); return }

    const finalTitle = title.trim() || (mode === 'select' ? `${selectedKeyword?.text ?? ''}とは？` : `${keywordText}とは？`)

    setLoading(true)
    setError(null)

    const body =
      mode === 'select'
        ? { keywordId, title: finalTitle, ownInsights: ownInsights.trim() || undefined }
        : { keywordText: keywordText.trim(), title: finalTitle, ownInsights: ownInsights.trim() || undefined }

    const res = await fetch('/api/seo/articles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (res.ok) {
      router.push('/dashboard/seo/articles?status=PENDING')
    } else {
      setError(data.error ?? 'エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* キーワード入力モード切替 */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium">キーワード</Label>
        <div className="mb-3 flex gap-1">
          <button
            type="button"
            onClick={() => setMode('free')}
            className={`rounded px-3 py-1 text-xs transition-colors ${
              mode === 'free' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-accent text-muted-foreground'
            }`}
          >
            自由入力
          </button>
          {keywords.length > 0 && (
            <button
              type="button"
              onClick={() => setMode('select')}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                mode === 'select' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-accent text-muted-foreground'
              }`}
            >
              登録キーワードから選択
            </button>
          )}
        </div>

        {mode === 'free' ? (
          <Input
            placeholder="例: 中小企業 マーケティング 自動化"
            value={keywordText}
            onChange={(e) => setKeywordText(e.target.value)}
            className="text-sm"
          />
        ) : (
          <select
            value={keywordId}
            onChange={(e) => handleKeywordSelect(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">キーワードを選択...</option>
            {keywords.map((kw) => (
              <option key={kw.id} value={kw.id}>
                {kw.text}
                {kw.position ? ` (現在順位: ${kw.position}位)` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* タイトル */}
      <div>
        <Label htmlFor="title" className="mb-1.5 block text-xs font-medium">
          記事タイトル
          <span className="ml-1 text-muted-foreground font-normal">（任意 — 空白なら AI が決定）</span>
        </Label>
        <Input
          id="title"
          placeholder="例: 中小企業がマーケティングを自動化すべき理由と実践方法"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-sm"
        />
      </div>

      {/* 独自情報 */}
      <div>
        <Label htmlFor="insights" className="mb-1.5 block text-xs font-medium">
          独自情報・事例
          <span className="ml-1 text-muted-foreground font-normal">（任意）</span>
        </Label>
        <Textarea
          id="insights"
          placeholder={`自社の強み、実績データ、事例など記事に盛り込みたい情報を入力してください。\n例: 導入企業の80%が3ヶ月でリード獲得数が2倍になった実績がある`}
          value={ownInsights}
          onChange={(e) => setOwnInsights(e.target.value)}
          rows={4}
          className="text-sm resize-none"
        />
      </div>

      {error && (
        <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {loading && (
        <div className="rounded border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            記事を生成中...（1〜2分かかります）
          </p>
          <p>ユーザーニーズ調査 → 競合文字数取得 → Hタグ設計 → SEO Title/Description生成 → 本文生成</p>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            記事ドラフトを生成
          </>
        )}
      </Button>
    </form>
  )
}
