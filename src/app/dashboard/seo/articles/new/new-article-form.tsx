'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Search,
  Shield,
  Tags,
  MessageSquare,
} from 'lucide-react'

// ─── 型定義 ────────────────────────────────────────────────────────

type Keyword = { id: string; text: string; position: number | null }

type Phase = 'form' | 'submitting'

// ─── メインフォーム ────────────────────────────────────────────────

type Props = { keywords: Keyword[]; projectId?: string }

export default function NewArticleForm({ keywords, projectId }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('form')

  // フォーム入力
  const [mode, setMode] = useState<'select' | 'free'>('free')
  const [keywordId, setKeywordId] = useState('')
  const [keywordText, setKeywordText] = useState('')
  const [title, setTitle] = useState('')
  const [ownInsights, setOwnInsights] = useState('')
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [avoidSensationalHeadings, setAvoidSensationalHeadings] = useState(false)
  const [trustedSourcesOnly, setTrustedSourcesOnly] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const selectedKeyword = keywords.find((k) => k.id === keywordId)

  function handleKeywordSelect(id: string) {
    setKeywordId(id)
    const kw = keywords.find((k) => k.id === id)
    if (kw && !title) setTitle(`${kw.text}とは？`)
  }

  function getEffectiveKeyword() {
    return mode === 'select'
      ? (selectedKeyword?.text ?? '')
      : keywordText.trim()
  }

  // ─── 分析開始（バックグラウンド） ─────────────────────────────

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    const kw = getEffectiveKeyword()
    if (!kw) { setError('キーワードを入力してください'); return }

    const finalTitle = title.trim() || `${kw}とは？`
    setError(null)
    setPhase('submitting')

    try {
      const res = await fetch('/api/seo/articles/analyze-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kw,
          title: finalTitle,
          projectId: projectId || undefined,
          ownInsights: ownInsights.trim() || undefined,
          relatedKeywords: relatedKeywords.trim() || undefined,
          avoidSensationalHeadings: avoidSensationalHeadings || undefined,
          trustedSourcesOnly: trustedSourcesOnly || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `分析の開始に失敗しました (${res.status})`)
      router.push(projectId ? `/dashboard/p/${projectId}/seo/articles?generating=1` : '/dashboard/seo/articles?generating=1')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
      setPhase('form')
    }
  }

  // ─── レンダリング ──────────────────────────────────────────────

  if (phase === 'submitting') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <p className="font-medium">分析ジョブを登録中...</p>
          <p className="mt-1 text-sm text-muted-foreground">完了後に記事一覧へ移動します</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleAnalyze} className="space-y-5">
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

      {/* 関連キーワード */}
      <div>
        <Label htmlFor="relatedKeywords" className="mb-1.5 block text-xs font-medium">
          <Tags className="mr-1 inline h-3.5 w-3.5" />
          関連キーワード
          <span className="ml-1 text-muted-foreground font-normal">（任意 — 見出し・本文に含める）</span>
        </Label>
        <input
          id="relatedKeywords"
          type="text"
          placeholder="例: MA, マーケティングオートメーション, リード獲得, BtoB"
          value={relatedKeywords}
          onChange={(e) => setRelatedKeywords(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">カンマ区切りで入力。見出しと本文に自然な形で組み込まれます。</p>
      </div>

      {/* 見出しトーン */}
      <div className="rounded-lg border border-border p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={avoidSensationalHeadings}
              onChange={(e) => setAvoidSensationalHeadings(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-4 w-4 rounded border border-border bg-background peer-checked:border-primary peer-checked:bg-primary transition-colors flex items-center justify-center">
              {avoidSensationalHeadings && (
                <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <div className="flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              あおり系の見出しを避ける
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              「衝撃の〜」「絶対に〜すべき」「知らないと損」などの煽情的な表現を避け、
              中立的・専門的なトーンの見出しを生成します。
            </p>
          </div>
        </label>
      </div>

      {/* 信頼性の高いソースのみ使用 */}
      <div className="rounded-lg border border-border p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={trustedSourcesOnly}
              onChange={(e) => setTrustedSourcesOnly(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-4 w-4 rounded border border-border bg-background peer-checked:border-primary peer-checked:bg-primary transition-colors flex items-center justify-center">
              {trustedSourcesOnly && (
                <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <div className="flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Shield className="h-3.5 w-3.5 text-primary" />
              信頼性の高い参照元のみ使用
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              政府機関・官公庁（.go.jp等）、国際機関（WHO/UN等）、主要研究機関・大学、
              東証プライム上場企業・Fortune500企業の公式情報のみを参照元として引用します。
              すべての統計・データに出典が明記されます。
            </p>
          </div>
        </label>
      </div>

      {error && (
        <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full">
        <Search className="mr-2 h-4 w-4" />
        記事を生成する
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        バックグラウンドで分析・生成します。完了まで1〜3分かかります。
      </p>
    </form>
  )
}
