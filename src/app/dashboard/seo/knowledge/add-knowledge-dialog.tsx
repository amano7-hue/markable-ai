'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { put } from '@vercel/blob/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe, PenLine, FileText, Loader2, Plus } from 'lucide-react'

type Tab = 'url' | 'manual' | 'pdf'

const CATEGORIES = [
  { value: 'case_study', label: '導入事例' },
  { value: 'service', label: 'サービス情報' },
  { value: 'company', label: '会社情報' },
  { value: 'other', label: 'その他' },
]

export default function AddKnowledgeDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('url')
  const [loading, setLoading] = useState(false)

  // URL
  const [url, setUrl] = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [urlCategory, setUrlCategory] = useState('other')

  // Manual
  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [manualCategory, setManualCategory] = useState('other')

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfTitle, setPdfTitle] = useState('')
  const [pdfCategory, setPdfCategory] = useState('other')

  function reset() {
    setUrl(''); setUrlTitle(''); setUrlCategory('other')
    setManualTitle(''); setManualContent(''); setManualCategory('other')
    setPdfFile(null); setPdfTitle(''); setPdfCategory('other')
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      if (tab === 'url') {
        const res = await fetch('/api/seo/knowledge/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, category: urlCategory, title: urlTitle }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'クロールに失敗しました')
        toast.success(`「${data.data?.title}」を登録しました`)

      } else if (tab === 'manual') {
        const res = await fetch('/api/seo/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'MANUAL', category: manualCategory, title: manualTitle, content: manualContent }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? '登録に失敗しました')
        toast.success(`「${manualTitle}」を登録しました`)

      } else if (tab === 'pdf') {
        if (!pdfFile) throw new Error('PDF ファイルを選択してください')
        // Step 1: サーバーからクライアントトークン取得
        const tokenRes = await fetch('/api/seo/knowledge/upload-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: pdfFile.name }),
        })
        const tokenData = await tokenRes.json().catch(() => ({ error: 'トークン取得に失敗しました' }))
        if (!tokenRes.ok) throw new Error(tokenData.error ?? 'トークン取得に失敗しました')

        // Step 2: Vercel Blob へ直接アップロード（Vercel 関数を経由しないため 30MB 可）
        // pathname はサーバー生成値を使う（トークンに埋め込まれた pathname と一致させる必要がある）
        const blob = await put(tokenData.pathname, pdfFile, {
          access: 'public',
          token: tokenData.clientToken,
          multipart: true, // 分割並列アップロードで大きなファイルを高速化
        })
        // Step 3: Blob URL を渡してテキスト抽出・DB 保存
        const res = await fetch('/api/seo/knowledge/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blobUrl: blob.url, category: pdfCategory, title: pdfTitle }),
        })
        const data = await res.json().catch(() => ({ error: 'サーバーエラーが発生しました' }))
        if (!res.ok) throw new Error(data.error ?? 'アップロードに失敗しました')
        toast.success(`「${data.data?.title}」を登録しました`)
      }

      setOpen(false)
      reset()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = tab === 'url' ? !!url.trim()
    : tab === 'manual' ? !!manualTitle.trim() && !!manualContent.trim()
    : !!pdfFile

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">
        <Plus className="h-3.5 w-3.5" />
        ナレッジを追加
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ナレッジを追加</DialogTitle>
        </DialogHeader>

        {/* タブ */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {([
            { key: 'url', label: 'URL クロール', icon: Globe },
            { key: 'manual', label: '手動入力', icon: PenLine },
            { key: 'pdf', label: 'PDF アップロード', icon: FileText },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                tab === key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 py-1">
          {/* URL タブ */}
          {tab === 'url' && (
            <>
              <div className="space-y-1.5">
                <Label>URL <span className="text-destructive">*</span></Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/case-study" type="url" />
              </div>
              <div className="space-y-1.5">
                <Label>タイトル（省略可）</Label>
                <Input value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} placeholder="ページタイトルを自動取得します" />
              </div>
              <div className="space-y-1.5">
                <Label>カテゴリ</Label>
                <Select value={urlCategory} onValueChange={(v) => { if (v) setUrlCategory(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* 手動入力タブ */}
          {tab === 'manual' && (
            <>
              <div className="space-y-1.5">
                <Label>タイトル <span className="text-destructive">*</span></Label>
                <Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="例: 〇〇社 導入事例" />
              </div>
              <div className="space-y-1.5">
                <Label>内容 <span className="text-destructive">*</span></Label>
                <Textarea
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  placeholder="導入事例・サービス情報・会社説明など、記事生成の参考にしたい情報を自由に入力してください"
                  rows={6}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label>カテゴリ</Label>
                <Select value={manualCategory} onValueChange={(v) => { if (v) setManualCategory(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* PDF タブ */}
          {tab === 'pdf' && (
            <>
              <div className="space-y-1.5">
                <Label>PDF ファイル <span className="text-destructive">*</span></Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">最大 30MB。Claude AI がテキストを抽出します</p>
              </div>
              <div className="space-y-1.5">
                <Label>タイトル（省略可）</Label>
                <Input value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} placeholder="ファイル名から自動設定されます" />
              </div>
              <div className="space-y-1.5">
                <Label>カテゴリ</Label>
                <Select value={pdfCategory} onValueChange={(v) => { if (v) setPdfCategory(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tab === 'url' ? 'クロール中...' : tab === 'pdf' ? 'PDF 読み込み中...' : '登録中...'}</> : '登録'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
