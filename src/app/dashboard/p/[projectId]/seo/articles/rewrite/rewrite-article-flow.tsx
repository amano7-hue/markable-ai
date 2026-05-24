'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ArrowRight, RefreshCw, TrendingUp, BarChart2, ChevronUp, ChevronDown, Plus, Trash2, CheckCircle2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { AnalyzeResult, RewriteSuggestion, HeadingItem } from '@/app/api/seo/articles/rewrite-existing/route'

type Step = 'input' | 'suggestions' | 'structure'

const CATEGORY_LABELS: Record<RewriteSuggestion['category'], string> = {
  title: 'タイトル最適化',
  headings: '見出し構成',
  intro: '導入文',
  keyword_density: 'キーワード密度',
  direct_answer: 'ダイレクトアンサー',
  faq: 'FAQ構造',
  entity: 'エンティティ明確化',
  structure: 'コンテンツ構造',
  cta: 'CTA',
  llmo: 'LLMO対応',
}

const PRIORITY_COLORS: Record<RewriteSuggestion['priority'], string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
}

const PRIORITY_LABELS: Record<RewriteSuggestion['priority'], string> = {
  high: '優先度: 高',
  medium: '優先度: 中',
  low: '優先度: 低',
}

const LEVEL_LABELS: Record<1 | 2 | 3, string> = { 1: 'H1', 2: 'H2', 3: 'H3' }
const LEVEL_COLORS: Record<1 | 2 | 3, string> = {
  1: 'bg-primary text-primary-foreground',
  2: 'bg-muted text-foreground border',
  3: 'bg-muted/50 text-muted-foreground border',
}

export default function RewriteArticleFlow({ projectId }: { projectId: string }) {
  const [step, setStep] = useState<Step>('input')
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url')
  const [url, setUrl] = useState('')
  const [pastedContent, setPastedContent] = useState('')
  const [targetKeyword, setTargetKeyword] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [externalLinksNewTab, setExternalLinksNewTab] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // structure step state
  const [headings, setHeadings] = useState<(HeadingItem & { id: string })[]>([])
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false)
  const [structurePrompt, setStructurePrompt] = useState('')
  const [isRegeneratingStructure, setIsRegeneratingStructure] = useState(false)

  // 並行ジョブ管理
  type JobStatus = 'running' | 'done' | 'failed'
  const [pendingJobs, setPendingJobs] = useState<{ id: string; title: string; status: JobStatus; articleId?: string }[]>([])

  async function handleAnalyze() {
    setError(null)
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/seo/articles/rewrite-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          url: inputMode === 'url' ? url : undefined,
          content: inputMode === 'text' ? pastedContent : undefined,
          targetKeyword: targetKeyword || undefined,
          projectId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '分析に失敗しました')
        return
      }
      setAnalyzeResult(json)
      // デフォルトで高優先度を全選択
      const highIds = new Set(
        (json.suggestions as RewriteSuggestion[])
          .filter((s) => s.priority === 'high')
          .map((s) => s.id),
      )
      setSelectedIds(highIds)
      setStep('suggestions')
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析に失敗しました')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function handleGenerateStructure() {
    if (!analyzeResult) return
    setError(null)
    setIsGeneratingStructure(true)

    const selectedSuggestions = analyzeResult.suggestions
      .filter((s) => selectedIds.has(s.id))
      .map((s) => `[${s.label}] ${s.suggestion}`)

    try {
      const res = await fetch('/api/seo/articles/rewrite-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-structure',
          content: analyzeResult.content,
          title: analyzeResult.title ?? undefined,
          targetKeyword: targetKeyword || undefined,
          selectedSuggestions,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '構成の生成に失敗しました')
        return
      }
      const items = (json.headings as HeadingItem[]).map((h, i) => ({
        ...h,
        id: `h-${i}-${Date.now()}`,
      }))
      setHeadings(items)
      setStep('structure')
    } catch (e) {
      setError(e instanceof Error ? e.message : '構成の生成に失敗しました')
    } finally {
      setIsGeneratingStructure(false)
    }
  }

  async function handleRegenerateStructure() {
    if (!analyzeResult) return
    setError(null)
    setIsRegeneratingStructure(true)

    const selectedSuggestions = analyzeResult.suggestions
      .filter((s) => selectedIds.has(s.id))
      .map((s) => `[${s.label}] ${s.suggestion}`)

    try {
      const res = await fetch('/api/seo/articles/rewrite-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-structure',
          content: analyzeResult.content,
          title: analyzeResult.title ?? undefined,
          targetKeyword: targetKeyword || undefined,
          selectedSuggestions,
          additionalInstructions: structurePrompt.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '構成の再生成に失敗しました')
      const items = (json.headings as HeadingItem[]).map((h, i) => ({
        ...h,
        id: `h-${i}-${Date.now()}`,
      }))
      setHeadings(items)
      setStructurePrompt('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '構成の再生成に失敗しました')
    } finally {
      setIsRegeneratingStructure(false)
    }
  }

  function handleRewrite() {
    if (!analyzeResult) return
    setError(null)

    const selectedSuggestions = analyzeResult.suggestions
      .filter((s) => selectedIds.has(s.id))
      .map((s) => `[${s.label}] ${s.suggestion}`)

    // 承認済み構成を additionalInstructions に付加
    const structureText = headings.length > 0
      ? `【承認済み記事構成（この見出し構成を厳密に守ること）】\n${headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`).join('\n')}`
      : ''
    const combinedInstructions = [structureText, additionalInstructions].filter(Boolean).join('\n\n')

    const jobTitle = analyzeResult.title ?? (targetKeyword ? `${targetKeyword}（リライト）` : 'リライト記事')
    const jobId = `job-${Date.now()}`

    // ジョブをバナーに即時追加してフォームをリセット（並行生成対応）
    setPendingJobs((prev) => [...prev, { id: jobId, title: jobTitle, status: 'running' }])
    setStep('input')
    setUrl('')
    setPastedContent('')
    setTargetKeyword('')
    setAnalyzeResult(null)
    setSelectedIds(new Set())
    setAdditionalInstructions('')
    setExternalLinksNewTab(false)
    setHeadings([])
    setError(null)

    // fire-and-forget: 生成完了まで最大 3〜4 分かかる
    fetch('/api/seo/articles/rewrite-existing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rewrite',
        content: analyzeResult.content,
        title: analyzeResult.title ?? undefined,
        targetKeyword: targetKeyword || undefined,
        selectedSuggestions,
        additionalInstructions: combinedInstructions || undefined,
        projectId,
        competitorAvgWordCount: analyzeResult.competitor?.averageWordCount,
        externalLinksNewTab: externalLinksNewTab || undefined,
      }),
    })
      .then(async (res) => {
        const json = await res.json()
        if (res.ok) {
          setPendingJobs((prev) =>
            prev.map((j) => j.id === jobId ? { ...j, status: 'done', articleId: json.articleId } : j),
          )
        } else {
          setPendingJobs((prev) =>
            prev.map((j) => j.id === jobId ? { ...j, status: 'failed' } : j),
          )
        }
      })
      .catch(() => {
        setPendingJobs((prev) =>
          prev.map((j) => j.id === jobId ? { ...j, status: 'failed' } : j),
        )
      })
  }

  function toggleSuggestion(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(analyzeResult?.suggestions.map((s) => s.id) ?? []))
  }
  function selectNone() {
    setSelectedIds(new Set())
  }

  // ─── 見出し編集ヘルパー ────────────────────────────────────────
  function updateHeadingText(id: string, text: string) {
    setHeadings((prev) => prev.map((h) => h.id === id ? { ...h, text } : h))
  }
  function cycleLevel(id: string) {
    setHeadings((prev) => prev.map((h) => {
      if (h.id !== id) return h
      const next = h.level === 1 ? 2 : h.level === 2 ? 3 : 2
      return { ...h, level: next as 1 | 2 | 3 }
    }))
  }
  function moveUp(index: number) {
    if (index === 0) return
    setHeadings((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }
  function moveDown(index: number) {
    setHeadings((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }
  function removeHeading(id: string) {
    setHeadings((prev) => prev.filter((h) => h.id !== id))
  }
  function addHeading() {
    setHeadings((prev) => [...prev, { id: `h-new-${Date.now()}`, level: 2, text: '' }])
  }

  // ─── 生成中ジョブバナー（常時表示） ──────────────────────────────
  const runningCount = pendingJobs.filter((j) => j.status === 'running').length
  const jobsBanner = pendingJobs.length > 0 ? (
    <div className="mb-6 rounded-lg border border-blue-300/60 bg-blue-50/40 dark:border-blue-700/40 dark:bg-blue-950/20 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {runningCount > 0 ? `生成中 ${runningCount}件` : '生成完了'}
        </p>
        <Link
          href={`/dashboard/p/${projectId}/seo/articles`}
          className="text-xs text-primary hover:underline"
        >
          記事一覧で確認 →
        </Link>
      </div>
      {pendingJobs.map((job) => (
        <div key={job.id} className="flex items-center gap-2 text-sm">
          {job.status === 'running' && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
          )}
          {job.status === 'done' && (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
          )}
          {job.status === 'failed' && (
            <span className="text-destructive text-xs shrink-0">✕</span>
          )}
          <span className={`truncate text-sm ${job.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {job.title}
            {job.status === 'failed' && ' — 生成失敗'}
          </span>
        </div>
      ))}
    </div>
  ) : null

  // ─── Step 1: 入力 ──────────────────────────────────────────────
  if (step === 'input') {
    return (
      <div className="space-y-6">
        {jobsBanner}
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'url' | 'text')}>
          <TabsList>
            <TabsTrigger value="url">URLを貼り付け</TabsTrigger>
            <TabsTrigger value="text">テキストを貼り付け</TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="url">記事URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </TabsContent>
          <TabsContent value="text" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="paste">記事テキスト</Label>
              <Textarea
                id="paste"
                placeholder="リライト対象の記事テキストを貼り付けてください..."
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <Label htmlFor="keyword">ターゲットキーワード（任意）</Label>
          <Input
            id="keyword"
            placeholder="例: コンテンツマーケティング"
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">入力すると競合記事の文字数を取得し、それを超える文字数で生成します。</p>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (inputMode === 'url' ? !url : !pastedContent)}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              SEO/LLMO分析を実行
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    )
  }

  // ─── Step 2: 改善提案選択 ───────────────────────────────────────
  if (step === 'suggestions' && analyzeResult) {
    const highCount = analyzeResult.suggestions.filter((s) => s.priority === 'high').length
    const medCount = analyzeResult.suggestions.filter((s) => s.priority === 'medium').length

    return (
      <div className="space-y-6">
        {/* スコア + 競合文字数 */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-4">
            <div className="text-center min-w-[60px]">
              <div className={`text-3xl font-bold ${analyzeResult.score >= 70 ? 'text-green-600' : analyzeResult.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {analyzeResult.score}
              </div>
              <div className="text-xs text-muted-foreground">SEO/LLMOスコア</div>
            </div>
            <div className="flex-1">
              {analyzeResult.title && (
                <p className="font-medium text-sm mb-1">{analyzeResult.title}</p>
              )}
              <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="text-red-600">高優先度 {highCount}件</span>
                <span className="text-yellow-600">中優先度 {medCount}件</span>
                <span className="text-green-600">低優先度 {analyzeResult.suggestions.length - highCount - medCount}件</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep('input')}>
              <RefreshCw className="mr-1 h-3 w-3" />
              やり直し
            </Button>
          </div>

          {/* 文字数比較 */}
          <div className="rounded-md bg-muted/50 p-3 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">現在の文字数:</span>
              <span className="font-medium">{analyzeResult.currentWordCount.toLocaleString()}文字</span>
            </div>
            {analyzeResult.competitor ? (
              <>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">競合平均:</span>
                  <span className="font-medium">{analyzeResult.competitor.averageWordCount.toLocaleString()}文字</span>
                </div>
                <div className="flex items-center gap-1.5 text-primary font-medium">
                  <ArrowRight className="h-4 w-4" />
                  <span>目標: {analyzeResult.competitor.recommendedWordCount.toLocaleString()}文字以上</span>
                </div>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">※ キーワードを入力すると競合文字数が表示されます</span>
            )}
          </div>
        </div>

        {/* 改善提案一覧 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">改善提案（{selectedIds.size}/{analyzeResult.suggestions.length} 選択）</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>全選択</Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectNone}>全解除</Button>
            </div>
          </div>

          {analyzeResult.suggestions.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${selectedIds.has(s.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
              onClick={() => toggleSuggestion(s.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(s.id)}
                  onCheckedChange={() => toggleSuggestion(s.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.label}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {CATEGORY_LABELS[s.category] ?? s.category}
                    </Badge>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${PRIORITY_COLORS[s.priority]}`}>
                      {PRIORITY_LABELS[s.priority]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.issue}</p>
                  <p className="text-sm">{s.suggestion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 追加指示 */}
        <div className="space-y-1.5">
          <Label htmlFor="extra">追加指示（任意）</Label>
          <Textarea
            id="extra"
            placeholder="例: 文体をカジュアルにしてほしい / CTAを2箇所追加してほしい"
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            rows={3}
          />
        </div>

        {/* 外部リンクを別タブで開く */}
        <div className="rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={externalLinksNewTab}
              onCheckedChange={(v) => setExternalLinksNewTab(!!v)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                会社・サービスのURLを別タブで開く（比較記事向け）
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                本文中で言及する会社・サービス・ツールの公式サイトへのリンクを
                <code className="mx-0.5 text-xs bg-muted px-1 rounded">target=&quot;_blank&quot;</code>
                で挿入します。
              </p>
            </div>
          </label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          <Button
            onClick={handleGenerateStructure}
            disabled={isGeneratingStructure}
            className="w-full"
          >
            {isGeneratingStructure ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                構成を生成中...
              </>
            ) : (
              <>
                記事構成を確認する
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            次のステップで見出し構成を確認・編集できます
          </p>
        </div>
      </div>
    )
  }

  // ─── Step 3: 構成確認・編集 ─────────────────────────────────────
  if (step === 'structure') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">記事構成の確認・編集</h2>
            <p className="text-xs text-muted-foreground mt-0.5">見出しの追加・削除・並び替え・レベル変更ができます</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStep('suggestions')}>
            <RefreshCw className="mr-1 h-3 w-3" />
            提案に戻る
          </Button>
        </div>

        <div className="space-y-1.5">
          {headings.map((h, i) => (
            <div key={h.id} className="flex items-center gap-2">
              {/* レベル切り替え */}
              <button
                type="button"
                onClick={() => cycleLevel(h.id)}
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-mono font-bold ${LEVEL_COLORS[h.level]}`}
                title="クリックでレベル変更"
              >
                {LEVEL_LABELS[h.level]}
              </button>

              {/* 見出しテキスト */}
              <Input
                value={h.text}
                onChange={(e) => updateHeadingText(h.id, e.target.value)}
                className={`flex-1 h-8 text-sm ${h.level === 1 ? 'font-bold' : h.level === 2 ? 'font-medium' : 'text-muted-foreground'}`}
                placeholder={`${LEVEL_LABELS[h.level]}見出しを入力`}
              />

              {/* 並び替え */}
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === headings.length - 1}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 削除 */}
              <button
                type="button"
                onClick={() => removeHeading(h.id)}
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 gap-1.5 text-muted-foreground"
            onClick={addHeading}
          >
            <Plus className="h-3.5 w-3.5" />
            見出しを追加
          </Button>
        </div>

        {/* プロンプトで構成を再生成 */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">構成を修正して再生成</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={structurePrompt}
              onChange={(e) => setStructurePrompt(e.target.value)}
              placeholder="例: FAQセクションを追加して / 比較表を入れて / もっとシンプルにして"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => { if (e.key === 'Enter' && !isRegeneratingStructure) handleRegenerateStructure() }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateStructure}
              disabled={isRegeneratingStructure}
              className="shrink-0 gap-1.5"
            >
              {isRegeneratingStructure ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              再生成
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          <Button
            onClick={handleRewrite}
            disabled={headings.length === 0}
            className="w-full"
          >
            この構成でリライト開始
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            バックグラウンドで生成します。アイキャッチ画像・図解・CTAも自動生成されます。完了まで1〜3分かかります。
          </p>
        </div>
      </div>
    )
  }

  return null
}
