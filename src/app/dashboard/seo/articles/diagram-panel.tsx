'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import MermaidDiagram from '@/components/mermaid-diagram'
import ArticleTable from '@/components/article-table'
import { RefreshCw } from 'lucide-react'

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

interface Props {
  articleId: string
  diagrams: Diagram[]
  tables: Table[]
  featuredImageUrl: string | null
}

export default function DiagramPanel({ articleId, diagrams, tables, featuredImageUrl }: Props) {
  const router = useRouter()
  const [imgUrl, setImgUrl] = useState(featuredImageUrl)
  const [regeneratingImage, setRegeneratingImage] = useState(false)

  async function handleRegenerateImage() {
    setRegeneratingImage(true)
    const res = await fetch(`/api/seo/articles/${articleId}/regenerate-image`, { method: 'POST' })
    setRegeneratingImage(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(`アイキャッチ生成に失敗しました: ${d.error ?? res.status}`)
      return
    }
    const d = await res.json()
    setImgUrl(d.featuredImageUrl)
    toast.success('アイキャッチ画像を再生成しました')
    router.refresh()
  }

  if (diagrams.length === 0 && tables.length === 0 && !imgUrl) return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">アイキャッチ画像</p>
        <Button variant="ghost" size="sm" onClick={handleRegenerateImage} disabled={regeneratingImage}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${regeneratingImage ? 'animate-spin' : ''}`} />
          {regeneratingImage ? '生成中...' : '生成'}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">アイキャッチ画像</p>
          <Button variant="ghost" size="sm" onClick={handleRegenerateImage} disabled={regeneratingImage}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${regeneratingImage ? 'animate-spin' : ''}`} />
            {regeneratingImage ? '生成中...' : imgUrl ? '再生成' : '生成'}
          </Button>
        </div>
        {imgUrl && <img src={imgUrl} alt="アイキャッチ" className="w-full rounded-md object-cover max-h-48" />}
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
