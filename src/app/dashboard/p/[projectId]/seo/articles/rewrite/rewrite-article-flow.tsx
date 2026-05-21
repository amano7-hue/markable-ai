'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ArrowRight, Check, RefreshCw, Copy, CheckCheck } from 'lucide-react'
import type { AnalyzeResult, RewriteSuggestion } from '@/app/api/seo/articles/rewrite-existing/route'

type Step = 'input' | 'suggestions' | 'rewriting' | 'result'

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
  const [rewrittenContent, setRewrittenContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function handleRewrite() {
    if (!analyzeResult) return
    setError(null)
    setStep('rewriting')

    const selectedSuggestions = analyzeResult.suggestions
      .filter((s) => selectedIds.has(s.id))
      .map((s) => `[${s.label}] ${s.suggestion}`)

    try {
      const res = await fetch('/api/seo/articles/rewrite-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rewrite',
          content: analyzeResult.content,
          targetKeyword: targetKeyword || undefined,
          selectedSuggestions,
          additionalInstructions: additionalInstructions || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'リライトに失敗しました')
        setStep('suggestions')
        return
      }
      setRewrittenContent(json.rewrittenContent)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リライトに失敗しました')
      setStep('suggestions')
    }
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

  async function handleCopy() {
    await navigator.clipboard.writeText(rewrittenContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Step 1: 入力 ──────────────────────────────────────────────
  if (step === 'input') {
    return (
      <div className="space-y-6">
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
        {/* スコア */}
        <div className="rounded-lg border p-4 flex items-center gap-4">
          <div className="text-center">
            <div className={`text-3xl font-bold ${analyzeResult.score >= 70 ? 'text-green-600' : analyzeResult.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {analyzeResult.score}
            </div>
            <div className="text-xs text-muted-foreground">SEO/LLMOスコア</div>
          </div>
          <div className="flex-1">
            {analyzeResult.title && (
              <p className="font-medium text-sm mb-1">{analyzeResult.title}</p>
            )}
            <div className="flex gap-2 text-xs text-muted-foreground">
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleRewrite}
          disabled={selectedIds.size === 0}
        >
          選択した改善を適用してリライト（{selectedIds.size}件）
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  // ─── Step 3: リライト中 ─────────────────────────────────────────
  if (step === 'rewriting') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">AIがリライト中です。しばらくお待ちください...</p>
      </div>
    )
  }

  // ─── Step 4: 結果 ───────────────────────────────────────────────
  if (step === 'result') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">リライト完了</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <><CheckCheck className="mr-1 h-4 w-4" />コピー済み</>
              ) : (
                <><Copy className="mr-1 h-4 w-4" />HTMLをコピー</>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setStep('suggestions'); setRewrittenContent('') }}>
              <RefreshCw className="mr-1 h-3 w-3" />
              提案を変えて再リライト
            </Button>
          </div>
        </div>

        <Tabs defaultValue="preview">
          <TabsList>
            <TabsTrigger value="preview">プレビュー</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="mt-3">
            <div
              className="rounded-lg border p-6 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: rewrittenContent }}
            />
          </TabsContent>
          <TabsContent value="html" className="mt-3">
            <Textarea
              value={rewrittenContent}
              onChange={(e) => setRewrittenContent(e.target.value)}
              rows={30}
              className="font-mono text-xs"
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return null
}
