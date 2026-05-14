'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

import MermaidDiagram from '@/components/mermaid-diagram'
import ArticleTable from '@/components/article-table'
import { RefreshCw, Download, X } from 'lucide-react'

interface Diagram {
  id: string
  marker: string
  title: string
  mermaidCode: string
  imageUrl: string | null
}

interface Table {
  id: string
  marker: string
  title: string
  htmlContent: string
}

interface BrandColors { primary: string; secondary: string; accent: string; background: string; text: string }

interface Props {
  articleId: string
  diagrams: Diagram[]
  tables: Table[]
  featuredImageUrl: string | null
  brandColors?: BrandColors | null
}

function ImagePromptForm({
  loading,
  onSubmit,
  onCancel,
  placeholder = '例: 青空と都市のビジネスイメージ、抽象的なデジタルグラフィック',
}: {
  loading: boolean
  onSubmit: (prompt: string) => void
  onCancel: () => void
  placeholder?: string
}) {
  const [value, setValue] = useState('')
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">プロンプト（任意）</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={loading} className="h-7 text-xs">キャンセル</Button>
        <Button size="sm" onClick={() => onSubmit(value)} disabled={loading} className="h-7 text-xs gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '生成中...' : '再生成'}
        </Button>
      </div>
    </div>
  )
}

export default function DiagramPanel({ articleId, diagrams, tables, featuredImageUrl, brandColors }: Props) {
  const router = useRouter()
  const [imgUrl, setImgUrl] = useState(featuredImageUrl)
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const [showImgDownloadMenu, setShowImgDownloadMenu] = useState(false)
  const [showImgPrompt, setShowImgPrompt] = useState(false)
  const [imgPrompt, setImgPrompt] = useState('')

  const handleDownloadFeatured = useCallback(async (format: 'png' | 'jpeg') => {
    setShowImgDownloadMenu(false)
    if (!imgUrl) return
    try {
      const res = await fetch(`/api/private-blob?url=${encodeURIComponent(imgUrl)}`)
      const blob = await res.blob()
      const ext = format === 'jpeg' ? 'jpg' : 'png'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `featured-image.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('ダウンロードに失敗しました')
    }
  }, [imgUrl])

  async function handleRegenerateImage(customPrompt?: string) {
    setRegeneratingImage(true)
    setShowImgPrompt(false)
    const res = await fetch(`/api/seo/articles/${articleId}/regenerate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrompt: customPrompt?.trim() || undefined }),
    })
    setRegeneratingImage(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(`アイキャッチ生成に失敗しました: ${d.error ?? res.status}`)
      return
    }
    const d = await res.json()
    setImgUrl(d.featuredImageUrl)
    setImgPrompt('')
    toast.success('アイキャッチ画像を再生成しました')
    router.refresh()
  }

  if (diagrams.length === 0 && tables.length === 0 && !imgUrl) return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">アイキャッチ画像</p>
        <Button variant="ghost" size="sm" onClick={() => setShowImgPrompt((v) => !v)} disabled={regeneratingImage}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${regeneratingImage ? 'animate-spin' : ''}`} />
          {regeneratingImage ? '生成中...' : '生成'}
        </Button>
      </div>
      {showImgPrompt && (
        <ImagePromptForm
          loading={regeneratingImage}
          onSubmit={(p) => handleRegenerateImage(p)}
          onCancel={() => setShowImgPrompt(false)}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">アイキャッチ画像</p>
          <div className="flex items-center gap-1">
            {imgUrl && (
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => setShowImgDownloadMenu((v) => !v)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {showImgDownloadMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowImgDownloadMenu(false)} />
                    <div className="absolute right-0 top-full z-20 flex flex-col min-w-20 rounded border border-border bg-card shadow-md py-1 text-xs">
                      <button onClick={() => handleDownloadFeatured('png')} className="px-3 py-1.5 text-left hover:bg-accent transition-colors">PNG</button>
                      <button onClick={() => handleDownloadFeatured('jpeg')} className="px-3 py-1.5 text-left hover:bg-accent transition-colors">JPEG</button>
                    </div>
                  </>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowImgPrompt((v) => !v)} disabled={regeneratingImage}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${regeneratingImage ? 'animate-spin' : ''}`} />
              {regeneratingImage ? '生成中...' : imgUrl ? '再生成' : '生成'}
            </Button>
          </div>
        </div>
        {showImgPrompt && (
          <ImagePromptForm
            loading={regeneratingImage}
            onSubmit={(p) => handleRegenerateImage(p)}
            onCancel={() => setShowImgPrompt(false)}
          />
        )}
        {imgUrl && <img src={`/api/private-blob?url=${encodeURIComponent(imgUrl)}`} alt="アイキャッチ" className="w-full rounded-md object-cover max-h-48" />}
      </div>

      {diagrams.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">記事内図解</p>
          <div className="space-y-3">
            {diagrams.map((d) => (
              <MermaidDiagram
                key={d.id}
                diagramId={d.id}
                articleId={articleId}
                title={d.title}
                mermaidCode={d.mermaidCode}
                imageUrl={d.imageUrl}
                brandColors={brandColors}
              />
            ))}
          </div>
        </div>
      )}

      {tables.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">記事内テーブル</p>
          <div className="space-y-3">
            {tables.map((t) => (
              <ArticleTable
                key={t.id}
                tableId={t.id}
                articleId={articleId}
                title={t.title}
                htmlContent={t.htmlContent}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
