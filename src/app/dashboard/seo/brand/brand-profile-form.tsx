'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { X, Plus, Upload, Trash2, ImageIcon, Palette } from 'lucide-react'

const TONE_OPTIONS = [
  { value: 'formal', label: '丁寧・フォーマル', desc: '「〜です・ます」調。信頼感重視' },
  { value: 'technical', label: '専門的・技術的', desc: '専門用語を積極使用。エンジニア向け' },
  { value: 'casual', label: 'カジュアル', desc: '親しみやすい表現。読みやすさ重視' },
  { value: 'friendly', label: '親近感・対話調', desc: '読者に語りかける文体' },
]

const DIAGRAM_PREFERENCE_OPTIONS = [
  { value: 'auto',            label: '自動（AI判断）',   desc: '記事内容に最適な図解を自動選択' },
  { value: 'flowchart',       label: 'フローチャート',   desc: '手順・プロセス・決定フロー向け' },
  { value: 'sequenceDiagram', label: 'シーケンス図',     desc: 'システム連携・時系列フロー向け' },
  { value: 'graph',           label: 'グラフ（LR）',     desc: '関係・ネットワーク構造向け' },
]

type PreferredPhrase = { from: string; to: string }

type BrandColors = { primary: string; secondary: string; accent: string; background: string; text: string }

const COLOR_LABELS: Record<keyof BrandColors, string> = {
  primary: 'プライマリ',
  secondary: 'セカンダリ',
  accent: 'アクセント',
  background: '背景',
  text: 'テキスト',
}

const DEFAULT_COLORS: BrandColors = {
  primary: '#3b82f6',
  secondary: '#6366f1',
  accent: '#f59e0b',
  background: '#ffffff',
  text: '#111827',
}

type Props = {
  projectId?: string
  initialData: {
    tone: string
    companyDescription: string
    ngWords: string[]
    preferredPhrases: PreferredPhrase[]
    diagramPreference: string
    diagramInstructions: string
    imageStyleInstructions: string
    decorationRules: string
    referenceImageUrl: string
    brandColors: Record<string, string> | null
  }
}

export default function BrandProfileForm({ projectId, initialData }: Props) {
  const [tone, setTone] = useState(initialData.tone)
  const [companyDescription, setCompanyDescription] = useState(initialData.companyDescription)
  const [ngWords, setNgWords] = useState<string[]>(initialData.ngWords)
  const [ngInput, setNgInput] = useState('')
  const [preferredPhrases, setPreferredPhrases] = useState<PreferredPhrase[]>(initialData.preferredPhrases)
  const [diagramPreference, setDiagramPreference] = useState(initialData.diagramPreference || 'auto')
  const [diagramInstructions, setDiagramInstructions] = useState(initialData.diagramInstructions)
  const [imageStyleInstructions, setImageStyleInstructions] = useState(initialData.imageStyleInstructions)
  const [decorationRules, setDecorationRules] = useState(initialData.decorationRules)
  const [referenceImageUrl, setReferenceImageUrl] = useState(initialData.referenceImageUrl)
  const [brandColors, setBrandColors] = useState<BrandColors>(
    initialData.brandColors
      ? { ...DEFAULT_COLORS, ...initialData.brandColors }
      : DEFAULT_COLORS
  )
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deletingImage, setDeletingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  function addNgWord() {
    const word = ngInput.trim()
    if (!word || ngWords.includes(word)) return
    setNgWords((prev) => [...prev, word])
    setNgInput('')
  }

  function removeNgWord(w: string) {
    setNgWords((prev) => prev.filter((x) => x !== w))
  }

  function addPhrase() {
    setPreferredPhrases((prev) => [...prev, { from: '', to: '' }])
  }

  function updatePhrase(i: number, field: 'from' | 'to', value: string) {
    setPreferredPhrases((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  function removePhrase(i: number) {
    setPreferredPhrases((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleImageUpload(file: File) {
    setUploadingImage(true)
    const formData = new FormData()
    formData.append('file', file)
    if (projectId) formData.append('projectId', projectId)
    const res = await fetch('/api/seo/brand/reference-image', { method: 'POST', body: formData })
    setUploadingImage(false)
    if (!res.ok) { toast.error('アップロードに失敗しました'); return }
    const d = await res.json() as { data: { referenceImageUrl: string; brandColors?: Record<string, string> } }
    setReferenceImageUrl(d.data.referenceImageUrl)
    if (d.data.brandColors) {
      setBrandColors((prev) => ({ ...prev, ...d.data.brandColors }))
    }
    toast.success('参照画像をアップロードしました。ブランドカラーを自動抽出しました。')
  }

  async function handleImageDelete() {
    setDeletingImage(true)
    const res = await fetch('/api/seo/brand/reference-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    setDeletingImage(false)
    if (!res.ok) { toast.error('削除に失敗しました'); return }
    setReferenceImageUrl('')
    toast.success('参照画像を削除しました')
  }

  async function handleSave() {
    setLoading(true)
    const res = await fetch('/api/seo/brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        tone,
        companyDescription,
        ngWords,
        preferredPhrases: preferredPhrases.filter((p) => p.from.trim() && p.to.trim()),
        diagramPreference,
        diagramInstructions,
        imageStyleInstructions,
        decorationRules,
        brandColors,
      }),
    })
    setLoading(false)
    if (res.ok) toast.success('ブランド設定を保存しました')
    else toast.error('保存に失敗しました')
  }

  return (
    <div className="space-y-8">
      {/* トーン */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">文体・トーン</Label>
        <div className="grid grid-cols-2 gap-2">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTone(tone === opt.value ? '' : opt.value)}
              className={[
                'rounded-lg border p-3 text-left text-sm transition-colors',
                tone === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent',
              ].join(' ')}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* 会社説明 */}
      <div className="space-y-2">
        <Label htmlFor="companyDescription">会社・サービスの説明</Label>
        <Textarea
          id="companyDescription"
          value={companyDescription}
          onChange={(e) => setCompanyDescription(e.target.value)}
          placeholder="例: 〇〇株式会社は、中小企業向けのSaaS型マーケティング支援ツールを提供しています。2015年創業、導入実績500社超。"
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">記事のCTAや締めくくりで参照されます</p>
      </div>

      <Separator />

      {/* NG ワード */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">NGワード</Label>
        <div className="flex gap-2">
          <Input
            value={ngInput}
            onChange={(e) => setNgInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNgWord())}
            placeholder="例: 激安、圧倒的"
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addNgWord}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </div>
        {ngWords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ngWords.map((w) => (
              <span key={w} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                {w}
                <button type="button" onClick={() => removeNgWord(w)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">記事生成時にこれらの語を使用しないよう AI に指示します</p>
      </div>

      <Separator />

      {/* 言い回し */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">言い回しルール</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addPhrase}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            追加
          </Button>
        </div>
        {preferredPhrases.length === 0 ? (
          <p className="text-xs text-muted-foreground">例: 「御社」→「お客様」、「弊社」→「私たち」</p>
        ) : (
          <div className="space-y-2">
            {preferredPhrases.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={p.from}
                  onChange={(e) => updatePhrase(i, 'from', e.target.value)}
                  placeholder="使わない表現"
                  className="flex-1"
                />
                <span className="text-muted-foreground text-sm shrink-0">→</span>
                <Input
                  value={p.to}
                  onChange={(e) => updatePhrase(i, 'to', e.target.value)}
                  placeholder="代わりに使う表現"
                  className="flex-1"
                />
                <button type="button" onClick={() => removePhrase(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* 図解スタイル */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">図解スタイル設定</Label>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">図解の種類</Label>
          <div className="grid grid-cols-2 gap-2">
            {DIAGRAM_PREFERENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDiagramPreference(diagramPreference === opt.value ? 'auto' : opt.value)}
                className={[
                  'rounded-lg border p-3 text-left text-sm transition-colors',
                  diagramPreference === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent',
                ].join(' ')}
              >
                <p className="font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">記事生成時に使用するMermaid図解の種類を指定します</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="diagramInstructions" className="text-xs text-muted-foreground">図解への追加指示</Label>
          <Textarea
            id="diagramInstructions"
            value={diagramInstructions}
            onChange={(e) => setDiagramInstructions(e.target.value)}
            placeholder="例: 必ず3ステップ以内に収めること / 横型レイアウト(LR)を優先 / 各ノードに絵文字を使わない"
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      <Separator />

      {/* アイキャッチ画像スタイル */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">アイキャッチ画像スタイル指定</Label>
        <Textarea
          id="imageStyleInstructions"
          value={imageStyleInstructions}
          onChange={(e) => setImageStyleInstructions(e.target.value)}
          placeholder="例: 白を基調としたミニマルデザイン / 人物の写真を含めない / サービスのロゴカラーである緑を基調に"
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">AI生成アイキャッチ画像のスタイルを指定します</p>
      </div>

      <Separator />

      {/* HTML装飾ルール */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">HTML装飾ルール</Label>
        <Textarea
          id="decorationRules"
          value={decorationRules}
          onChange={(e) => setDecorationRules(e.target.value)}
          placeholder={"例:\n- 重要なキーワードは <strong> タグで強調する\n- 注意事項は <em> タグで斜体にする\n- 製品名・サービス名は <b> タグで太字にする"}
          rows={5}
          className="resize-none font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">記事生成時のHTML装飾ルールを自由記述で指定します。AIが本文生成時にこのルールを適用します。</p>
      </div>

      <Separator />

      {/* デザイン参照画像 */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">デザイン参照画像</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            アイキャッチ画像・図解の生成時にこの画像のスタイルを踏襲します。PNG / JPG / WebP、5MB以内。
          </p>
        </div>

        {referenceImageUrl ? (
          <div className="space-y-2">
            <div className="relative w-full overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/seo/brand/reference-image?url=${encodeURIComponent(referenceImageUrl)}`}
                alt="デザイン参照画像"
                className="w-full object-cover max-h-48"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                差し替え
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleImageDelete}
                disabled={deletingImage}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingImage ? '削除中...' : '削除'}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-50"
          >
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {uploadingImage ? 'アップロード中...' : 'クリックして画像をアップロード'}
            </span>
            <span className="text-xs text-muted-foreground">PNG / JPG / WebP・5MB以内</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) { void handleImageUpload(file) }
            e.target.value = ''
          }}
        />
      </div>

      <Separator />

      {/* ブランドカラー */}
      <div className="space-y-4">
        <div>
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Palette className="h-4 w-4" />
            ブランドカラー
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            アイキャッチ画像・図解生成時に使用するブランドカラーを指定します。参照画像をアップロードすると自動抽出されます。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(Object.keys(COLOR_LABELS) as (keyof BrandColors)[]).map((key) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{COLOR_LABELS[key]}</Label>
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 shrink-0 rounded border border-border cursor-pointer overflow-hidden"
                  title={`${COLOR_LABELS[key]}のカラーピッカー`}
                >
                  <input
                    type="color"
                    value={brandColors[key]}
                    onChange={(e) => setBrandColors((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="h-10 w-10 -translate-x-1 -translate-y-1 cursor-pointer border-0 p-0 opacity-100"
                  />
                </div>
                <input
                  type="text"
                  value={brandColors[key]}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                      setBrandColors((prev) => ({ ...prev, [key]: val }))
                    }
                  }}
                  placeholder="#000000"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
        {/* カラープレビュー */}
        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
          {(Object.keys(COLOR_LABELS) as (keyof BrandColors)[]).map((key) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <div
                className="h-8 w-8 rounded-full border border-border shadow-sm"
                style={{ backgroundColor: brandColors[key] }}
                title={`${COLOR_LABELS[key]}: ${brandColors[key]}`}
              />
              <span className="text-xs text-muted-foreground">{COLOR_LABELS[key]}</span>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? '保存中...' : '保存'}
      </Button>
    </div>
  )
}
