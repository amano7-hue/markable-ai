'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2, Search, Shield, Tags, MessageSquare, ArrowRight,
  CheckCircle2, ChevronUp, ChevronDown, Plus, Trash2, RefreshCw,
} from 'lucide-react'
import type { NewArticleHeadingItem } from '@/app/api/seo/articles/analyze-async/route'

type Keyword = { id: string; text: string; position: number | null }
type Phase = 'form' | 'analyzing' | 'structure'

type HeadingItem = NewArticleHeadingItem & { id: string }

type JobStatus = 'running' | 'done' | 'failed'
type PendingJob = { id: string; title: string; status: JobStatus }

const LEVEL_LABELS: Record<1 | 2 | 3, string> = { 1: 'H1', 2: 'H2', 3: 'H3' }
const LEVEL_COLORS: Record<1 | 2 | 3, string> = {
  1: 'bg-primary text-primary-foreground',
  2: 'bg-muted text-foreground border',
  3: 'bg-muted/50 text-muted-foreground border',
}

type Props = { keywords: Keyword[]; projectId?: string }

export default function NewArticleForm({ keywords, projectId }: Props) {
  const [phase, setPhase] = useState<Phase>('form')

  // form state
  const [mode, setMode] = useState<'select' | 'free'>('free')
  const [keywordId, setKeywordId] = useState('')
  const [keywordText, setKeywordText] = useState('')
  const [title, setTitle] = useState('')
  const [ownInsights, setOwnInsights] = useState('')
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [avoidSensationalHeadings, setAvoidSensationalHeadings] = useState(false)
  const [trustedSourcesOnly, setTrustedSourcesOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // structure step state
  const [headings, setHeadings] = useState<HeadingItem[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // parallel jobs
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([])

  const selectedKeyword = keywords.find((k) => k.id === keywordId)

  function handleKeywordSelect(id: string) {
    setKeywordId(id)
    const kw = keywords.find((k) => k.id === id)
    if (kw && !title) setTitle(`${kw.text}とは？`)
  }

  function getEffectiveKeyword() {
    return mode === 'select' ? (selectedKeyword?.text ?? '') : keywordText.trim()
  }

  // ─── 構成生成 ──────────────────────────────────────────────────
  async function handleAnalyzeStructure(e: React.FormEvent) {
    e.preventDefault()
    const kw = getEffectiveKeyword()
    if (!kw) { setError('キーワードを入力してください'); return }
    const finalTitle = title.trim() || `${kw}とは？`
    if (!title.trim()) setTitle(finalTitle)

    setError(null)
    setIsAnalyzing(true)
    setPhase('analyzing')

    try {
      const res = await fetch('/api/seo/articles/analyze-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'structure', keyword: kw, title: finalTitle, projectId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '構成の生成に失敗しました')
      const items = (data.headings as NewArticleHeadingItem[]).map((h, i) => ({
        ...h,
        id: `h-${i}-${Date.now()}`,
      }))
      setHeadings(items)
      setPhase('structure')
    } catch (e) {
      setError(e instanceof Error ? e.message : '構成の生成に失敗しました')
      setPhase('form')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ─── 記事生成（fire-and-forget） ──────────────────────────────
  function handleGenerate() {
    const kw = getEffectiveKeyword()
    const finalTitle = title.trim() || `${kw}とは？`

    // headings → customHeadings 変換
    const h1Item = headings.find(h => h.level === 1)
    const h1 = h1Item?.text ?? finalTitle
    const sections: { h2: string; h3s: string[] }[] = []
    let current: { h2: string; h3s: string[] } | null = null
    for (const item of headings.filter(h => h.level !== 1)) {
      if (item.level === 2) {
        current = { h2: item.text, h3s: [] }
        sections.push(current)
      } else if (item.level === 3 && current) {
        current.h3s.push(item.text)
      }
    }
    const customHeadings = sections.length > 0 ? { h1, sections } : undefined

    const jobId = `job-${Date.now()}`
    setPendingJobs(prev => [...prev, { id: jobId, title: finalTitle, status: 'running' }])

    // フォームをリセット
    setPhase('form')
    setKeywordText('')
    setKeywordId('')
    setTitle('')
    setOwnInsights('')
    setRelatedKeywords('')
    setAvoidSensationalHeadings(false)
    setTrustedSourcesOnly(false)
    setHeadings([])
    setError(null)

    fetch('/api/seo/articles/analyze-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate',
        keyword: kw,
        title: finalTitle,
        projectId,
        ownInsights: ownInsights.trim() || undefined,
        relatedKeywords: relatedKeywords.trim() || undefined,
        avoidSensationalHeadings: avoidSensationalHeadings || undefined,
        trustedSourcesOnly: trustedSourcesOnly || undefined,
        customHeadings,
      }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        setPendingJobs(prev =>
          prev.map(j => j.id === jobId ? { ...j, status: res.ok ? 'done' : 'failed' } : j),
        )
        if (!res.ok) console.error('[new-article] generate failed:', json)
      })
      .catch(() => {
        setPendingJobs(prev =>
          prev.map(j => j.id === jobId ? { ...j, status: 'failed' } : j),
        )
      })
  }

  // ─── 見出し編集ヘルパー ────────────────────────────────────────
  function updateHeadingText(id: string, text: string) {
    setHeadings(prev => prev.map(h => h.id === id ? { ...h, text } : h))
  }
  function cycleLevel(id: string) {
    setHeadings(prev => prev.map(h => {
      if (h.id !== id) return h
      const next = h.level === 1 ? 2 : h.level === 2 ? 3 : 2
      return { ...h, level: next as 1 | 2 | 3 }
    }))
  }
  function moveUp(index: number) {
    if (index === 0) return
    setHeadings(prev => { const n = [...prev]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; return n })
  }
  function moveDown(index: number) {
    setHeadings(prev => {
      if (index >= prev.length - 1) return prev
      const n = [...prev]; [n[index], n[index + 1]] = [n[index + 1], n[index]]; return n
    })
  }
  function removeHeading(id: string) {
    setHeadings(prev => prev.filter(h => h.id !== id))
  }
  function addHeading() {
    setHeadings(prev => [...prev, { id: `h-new-${Date.now()}`, level: 2, text: '' }])
  }

  const runningCount = pendingJobs.filter(j => j.status === 'running').length

  // ─── ジョブバナー ──────────────────────────────────────────────
  const jobsBanner = pendingJobs.length > 0 ? (
    <div className="mb-6 rounded-lg border border-blue-300/60 bg-blue-50/40 dark:border-blue-700/40 dark:bg-blue-950/20 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {runningCount > 0 ? `生成中 ${runningCount}件` : '生成完了'}
        </p>
        <Link
          href={projectId ? `/dashboard/p/${projectId}/seo/articles` : '/dashboard/seo/articles'}
          className="text-xs text-primary hover:underline"
        >
          記事一覧で確認 →
        </Link>
      </div>
      {pendingJobs.map(job => (
        <div key={job.id} className="flex items-center gap-2 text-sm">
          {job.status === 'running' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />}
          {job.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />}
          {job.status === 'failed' && <span className="text-destructive text-xs shrink-0">✕</span>}
          <span className={`truncate text-sm ${job.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {job.title}{job.status === 'failed' ? ' — 生成失敗' : ''}
          </span>
        </div>
      ))}
    </div>
  ) : null

  // ─── 構成確認・編集ステップ ─────────────────────────────────────
  if (phase === 'structure') {
    return (
      <div className="space-y-6">
        {jobsBanner}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">記事構成の確認・編集</h2>
            <p className="text-xs text-muted-foreground mt-0.5">見出しの追加・削除・並び替え・レベル変更ができます</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPhase('form')}>
            <RefreshCw className="mr-1 h-3 w-3" />
            入力に戻る
          </Button>
        </div>

        <div className="space-y-1.5">
          {headings.map((h, i) => (
            <div key={h.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cycleLevel(h.id)}
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-mono font-bold ${LEVEL_COLORS[h.level]}`}
                title="クリックでレベル変更"
              >
                {LEVEL_LABELS[h.level]}
              </button>
              <Input
                value={h.text}
                onChange={(e) => updateHeadingText(h.id, e.target.value)}
                className={`flex-1 h-8 text-sm ${h.level === 1 ? 'font-bold' : h.level === 2 ? 'font-medium' : 'text-muted-foreground'}`}
                placeholder={`${LEVEL_LABELS[h.level]}見出しを入力`}
              />
              <div className="flex flex-col shrink-0">
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveDown(i)} disabled={i === headings.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={() => removeHeading(h.id)} className="shrink-0 p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5 text-muted-foreground" onClick={addHeading}>
            <Plus className="h-3.5 w-3.5" />
            見出しを追加
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          <Button onClick={handleGenerate} disabled={headings.length === 0} className="w-full">
            この構成で記事を生成する
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            バックグラウンドで生成します。アイキャッチ画像・図解・CTAも自動生成されます。完了まで1〜3分かかります。
          </p>
        </div>
      </div>
    )
  }

  // ─── 分析中 ─────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <div className="space-y-6">
        {jobsBanner}
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <p className="font-medium">記事構成を生成中...</p>
            <p className="mt-1 text-sm text-muted-foreground">キーワードを分析しています（10〜20秒）</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── フォーム ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleAnalyzeStructure} className="space-y-5">
      {jobsBanner}

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

      <Button type="submit" disabled={isAnalyzing} className="w-full">
        {isAnalyzing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />分析中...</>
        ) : (
          <><Search className="mr-2 h-4 w-4" />構成を確認する<ArrowRight className="ml-2 h-4 w-4" /></>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        次のステップで記事の見出し構成を確認・編集できます
      </p>
    </form>
  )
}
