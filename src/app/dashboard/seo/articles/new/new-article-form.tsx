'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Search,
  Shield,
  User,
  LayoutList,
  Edit3,
} from 'lucide-react'

// ─── 型定義 ────────────────────────────────────────────────────────

type Keyword = { id: string; text: string; position: number | null }

type H2Section = { h2: string; h3s: string[] }

type HeadingStructure = { h1: string; sections: H2Section[] }

type AnalysisResult = {
  reader: {
    targetAudience: string
    searchIntent: string
    keyQuestions: string[]
    painPoints: string[]
    relatedQuestions: string[]
    relatedSearches: string[]
  }
  competitor: {
    recommendedWordCount: number
    averageWordCount: number
    reasoning: string
  }
  headings: HeadingStructure
}

type Phase = 'form' | 'analyzing' | 'review' | 'generating'

// ─── 見出し構成エディタ ────────────────────────────────────────────

function HeadingEditor({
  headings,
  onChange,
}: {
  headings: HeadingStructure
  onChange: (h: HeadingStructure) => void
}) {
  function updateH1(val: string) {
    onChange({ ...headings, h1: val })
  }

  function updateH2(i: number, val: string) {
    const sections = headings.sections.map((s, idx) => idx === i ? { ...s, h2: val } : s)
    onChange({ ...headings, sections })
  }

  function addH2() {
    onChange({ ...headings, sections: [...headings.sections, { h2: '', h3s: [] }] })
  }

  function removeH2(i: number) {
    onChange({ ...headings, sections: headings.sections.filter((_, idx) => idx !== i) })
  }

  function moveH2(i: number, dir: -1 | 1) {
    const sections = [...headings.sections]
    const j = i + dir
    if (j < 0 || j >= sections.length) return
    ;[sections[i], sections[j]] = [sections[j], sections[i]]
    onChange({ ...headings, sections })
  }

  function updateH3(si: number, hi: number, val: string) {
    const sections = headings.sections.map((s, idx) => {
      if (idx !== si) return s
      return { ...s, h3s: s.h3s.map((h, hidx) => hidx === hi ? val : h) }
    })
    onChange({ ...headings, sections })
  }

  function addH3(si: number) {
    const sections = headings.sections.map((s, idx) =>
      idx === si ? { ...s, h3s: [...s.h3s, ''] } : s
    )
    onChange({ ...headings, sections })
  }

  function removeH3(si: number, hi: number) {
    const sections = headings.sections.map((s, idx) =>
      idx === si ? { ...s, h3s: s.h3s.filter((_, hidx) => hidx !== hi) } : s
    )
    onChange({ ...headings, sections })
  }

  return (
    <div className="space-y-3">
      {/* H1 */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="mb-1 text-xs font-semibold text-primary">H1</p>
        <Input
          value={headings.h1}
          onChange={(e) => updateH1(e.target.value)}
          className="text-sm font-medium"
          placeholder="H1 見出し"
        />
      </div>

      {/* H2 sections */}
      {headings.sections.map((section, si) => (
        <div key={si} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">H2</span>
            <Input
              value={section.h2}
              onChange={(e) => updateH2(si, e.target.value)}
              className="flex-1 text-sm"
              placeholder="H2 見出し"
            />
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => moveH2(si, -1)}
                disabled={si === 0}
                className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                title="上へ移動"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveH2(si, 1)}
                disabled={si === headings.sections.length - 1}
                className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                title="下へ移動"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeH2(si)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="削除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* H3s */}
          <div className="ml-5 space-y-1.5">
            {section.h3s.map((h3, hi) => (
              <div key={hi} className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">H3</span>
                <Input
                  value={h3}
                  onChange={(e) => updateH3(si, hi, e.target.value)}
                  className="flex-1 text-xs"
                  placeholder="H3 見出し"
                />
                <button
                  type="button"
                  onClick={() => removeH3(si, hi)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addH3(si)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              H3 を追加
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addH2}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        H2 セクションを追加
      </button>
    </div>
  )
}

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
  const [trustedSourcesOnly, setTrustedSourcesOnly] = useState(false)

  // 分析結果 + ユーザー編集
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [persona, setPersona] = useState('')
  const [headings, setHeadings] = useState<HeadingStructure>({ h1: '', sections: [] })

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

  // ─── Step 1: 分析フェーズ ─────────────────────────────────────

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    const kw = getEffectiveKeyword()
    if (!kw) { setError('キーワードを入力してください'); return }

    const finalTitle = title.trim() || `${kw}とは？`
    setError(null)
    setPhase('analyzing')

    try {
      const res = await fetch('/api/seo/articles/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw, title: finalTitle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '分析に失敗しました')

      const result = data.data as AnalysisResult
      setAnalysis(result)
      setPersona(result.reader.targetAudience)
      setHeadings(result.headings)
      setTitle(finalTitle)
      setPhase('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
      setPhase('form')
    }
  }

  // ─── Step 2: 生成フェーズ ─────────────────────────────────────

  async function handleGenerate() {
    const kw = getEffectiveKeyword()
    setError(null)
    setPhase('generating')

    const body = {
      ...(mode === 'select' ? { keywordId } : { keywordText: kw }),
      title,
      projectId: projectId || undefined,
      ownInsights: ownInsights.trim() || undefined,
      persona: persona.trim() !== analysis?.reader.targetAudience ? persona.trim() || undefined : undefined,
      customHeadings: headings,
      trustedSourcesOnly: trustedSourcesOnly || undefined,
    }

    try {
      const res = await fetch('/api/seo/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '生成に失敗しました')
      router.push('/dashboard/seo/articles?status=PENDING')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
      setPhase('review')
    }
  }

  // ─── レンダリング ──────────────────────────────────────────────

  if (phase === 'analyzing') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <p className="font-medium">記事構成を分析中...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            SERP データ取得 → 読者ニーズ分析 → 競合文字数収集 → 見出し設計
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">20〜30秒ほどかかります</p>
        </div>
      </div>
    )
  }

  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <p className="font-medium">記事本文を生成中...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            SEO Title/Description生成 → 本文生成 → 図解・テーブル構成 → アイキャッチ画像生成
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">1〜2分かかります</p>
        </div>
      </div>
    )
  }

  if (phase === 'review' && analysis) {
    return (
      <div className="space-y-6">
        {/* 分析完了バナー */}
        <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/50 px-4 py-3 text-sm dark:border-emerald-700/40 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-700 dark:text-emerald-400">構成分析が完了しました</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ペルソナと見出し構成を確認・編集してから「この構成で記事を生成」してください。
          </p>
        </div>

        {/* 競合分析サマリー */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">競合分析</p>
          <p>競合平均: {analysis.competitor.averageWordCount.toLocaleString()}文字 → 目標: {analysis.competitor.recommendedWordCount.toLocaleString()}文字</p>
          <p className="text-muted-foreground/80">{analysis.competitor.reasoning}</p>
        </div>

        {/* ─── ペルソナ編集 ─── */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <User className="h-4 w-4 text-primary" />
            想定読者ペルソナ
          </Label>
          <p className="text-xs text-muted-foreground">
            AIが分析したペルソナです。対象読者が異なる場合はここで修正してください。
          </p>
          <Textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={3}
            className="text-sm resize-none"
            placeholder="例: 中小企業のマーケティング担当者（30〜40代）、マーケ経験3年以上、SaaSツール選定の決裁権を持つ"
          />
          {analysis.reader.keyQuestions.length > 0 && (
            <div className="mt-1 rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium mb-1">読者の主な疑問（分析結果）</p>
              <ul className="space-y-0.5">
                {analysis.reader.keyQuestions.slice(0, 3).map((q, i) => (
                  <li key={i}>・{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ─── 見出し構成エディタ ─── */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <LayoutList className="h-4 w-4 text-primary" />
            見出し構成（Hタグ）
          </Label>
          <p className="text-xs text-muted-foreground">
            H2・H3の順序や内容を自由に編集できます。確定後に記事本文を生成します。
          </p>
          <HeadingEditor headings={headings} onChange={setHeadings} />
        </div>

        {error && (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPhase('form')}
            className="flex-1"
          >
            ← 入力に戻る
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            className="flex-1"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            この構成で記事を生成
          </Button>
        </div>
      </div>
    )
  }

  // Phase: 'form'
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
        構成を分析する
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        分析後にペルソナと見出し構成を確認・編集できます
      </p>
    </form>
  )
}
