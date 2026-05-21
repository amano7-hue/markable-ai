'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2, Sparkles, ChevronDown, ChevronUp, Plus, Trash2, User, LayoutList,
} from 'lucide-react'

type H2Section = { h2: string; h3s: string[] }
type HeadingStructure = { h1: string; sections: H2Section[] }

type Analysis = {
  reader: {
    targetAudience: string
    searchIntent: string
    keyQuestions: string[]
    relatedQuestions: string[]
  }
  competitor: { recommendedWordCount: number; averageWordCount: number; reasoning: string }
  headings: HeadingStructure
  keyword?: string
  projectId?: string
  ownInsights?: string
  relatedKeywords?: string
  avoidSensationalHeadings?: boolean
  trustedSourcesOnly?: boolean
}

function HeadingEditor({ headings, onChange }: { headings: HeadingStructure; onChange: (h: HeadingStructure) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="mb-1 text-xs font-semibold text-primary">H1</p>
        <Input value={headings.h1} onChange={(e) => onChange({ ...headings, h1: e.target.value })} className="text-sm font-medium" placeholder="H1 見出し" />
      </div>
      {headings.sections.map((section, si) => (
        <div key={si} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">H2</span>
            <Input value={section.h2} onChange={(e) => { const s = headings.sections.map((sec, i) => i === si ? { ...sec, h2: e.target.value } : sec); onChange({ ...headings, sections: s }) }} className="flex-1 text-sm" />
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => { const s = [...headings.sections]; if (si > 0) { [s[si], s[si-1]] = [s[si-1], s[si]]; onChange({ ...headings, sections: s }) } }} disabled={si === 0} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => { const s = [...headings.sections]; if (si < s.length-1) { [s[si], s[si+1]] = [s[si+1], s[si]]; onChange({ ...headings, sections: s }) } }} disabled={si === headings.sections.length - 1} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => onChange({ ...headings, sections: headings.sections.filter((_, i) => i !== si) })} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="ml-5 space-y-1.5">
            {section.h3s.map((h3, hi) => (
              <div key={hi} className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">H3</span>
                <Input value={h3} onChange={(e) => { const s = headings.sections.map((sec, i) => i === si ? { ...sec, h3s: sec.h3s.map((h, j) => j === hi ? e.target.value : h) } : sec); onChange({ ...headings, sections: s }) }} className="flex-1 text-xs" />
                <button type="button" onClick={() => { const s = headings.sections.map((sec, i) => i === si ? { ...sec, h3s: sec.h3s.filter((_, j) => j !== hi) } : sec); onChange({ ...headings, sections: s }) }} className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            <button type="button" onClick={() => { const s = headings.sections.map((sec, i) => i === si ? { ...sec, h3s: [...sec.h3s, ''] } : sec); onChange({ ...headings, sections: s }) }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              <Plus className="h-3 w-3" /> H3 を追加
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...headings, sections: [...headings.sections, { h2: '', h3s: [] }] })} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
        <Plus className="h-3.5 w-3.5" /> H2 セクションを追加
      </button>
    </div>
  )
}

export default function ReviewHeadingsForm({
  articleId,
  title,
  projectId,
  analysis,
  basePath,
}: {
  articleId: string
  title: string
  projectId: string | null | undefined
  analysis: Analysis
  basePath: string
}) {
  const router = useRouter()
  const [headings, setHeadings] = useState<HeadingStructure>(analysis.headings)
  const [persona, setPersona] = useState(analysis.reader.targetAudience)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    setIsGenerating(true)

    const body = {
      keywordText: analysis.keyword,
      title,
      projectId: analysis.projectId ?? projectId ?? undefined,
      ownInsights: analysis.ownInsights,
      relatedKeywords: analysis.relatedKeywords,
      avoidSensationalHeadings: analysis.avoidSensationalHeadings,
      trustedSourcesOnly: analysis.trustedSourcesOnly,
      persona: persona !== analysis.reader.targetAudience ? persona : undefined,
      customHeadings: headings,
      existingArticleId: articleId,
      precomputedReader: analysis.reader,
      precomputedCompetitor: analysis.competitor,
    }

    try {
      const res = await fetch('/api/seo/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `生成に失敗しました (${res.status})`)
      router.push(`${basePath}/articles?generating=1`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 競合分析サマリー */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">競合分析</p>
        <p>競合平均: {analysis.competitor.averageWordCount.toLocaleString()}文字 → 目標: {analysis.competitor.recommendedWordCount.toLocaleString()}文字</p>
        <p className="text-muted-foreground/80">{analysis.competitor.reasoning}</p>
      </div>

      {/* ペルソナ編集 */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <User className="h-4 w-4 text-primary" />
          想定読者ペルソナ
        </Label>
        <Textarea value={persona} onChange={(e) => setPersona(e.target.value)} rows={3} className="text-sm resize-none" />
        {analysis.reader.keyQuestions.length > 0 && (
          <div className="mt-1 rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium mb-1">読者の主な疑問</p>
            <ul className="space-y-0.5">{analysis.reader.keyQuestions.slice(0, 3).map((q, i) => <li key={i}>・{q}</li>)}</ul>
          </div>
        )}
      </div>

      {/* 見出し構成エディタ */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <LayoutList className="h-4 w-4 text-primary" />
          見出し構成（Hタグ）
        </Label>
        <p className="text-xs text-muted-foreground">H2・H3の順序や内容を自由に編集してから生成してください。</p>
        <HeadingEditor headings={headings} onChange={setHeadings} />
      </div>

      {error && (
        <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(`${basePath}/articles`)} className="flex-1">
          ← 記事一覧に戻る
        </Button>
        <Button type="button" onClick={handleGenerate} disabled={isGenerating} className="flex-1">
          {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />生成を開始中...</> : <><Sparkles className="mr-2 h-4 w-4" />この構成で記事を生成</>}
        </Button>
      </div>
    </div>
  )
}
