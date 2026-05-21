'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Pencil, X } from 'lucide-react'
import RewriteSectionDialog, { splitArticleIntoSections } from './rewrite-section-dialog'

interface Props {
  articleId: string
  title: string
  brief: string
  draft?: string | null
}

export default function ArticleActions({ articleId, title: initTitle, brief: initBrief, draft: initDraft }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [title, setTitle] = useState(initTitle)
  const [brief, setBrief] = useState(initBrief)
  const [draft, setDraft] = useState(initDraft ?? '')

  const sections = initDraft ? splitArticleIntoSections(initDraft) : []

  function handleSectionRewrite(sectionH2: string, rewrittenHtml: string) {
    // H2テキストで対象セクションを特定し、ドラフトを更新
    setDraft((prev) => {
      const parts = prev.split(/(?=<h2[\s>])/i)
      const updated = parts.map((part) => {
        const h2Match = part.match(/<h2[^>]*>([^<]+)<\/h2>/i)
        if (h2Match && h2Match[1].trim() === sectionH2) {
          return rewrittenHtml
        }
        return part
      })
      return updated.join('')
    })
    setMode('edit')
  }

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    const hasEdits = title !== initTitle || brief !== initBrief || draft !== (initDraft ?? '')
    const res = await fetch(`/api/seo/articles/${articleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        ...(hasEdits ? { title, brief, ...(initDraft ? { draft } : {}) } : {}),
      }),
    })
    setLoading(null)
    if (res.ok) {
      toast.success(action === 'approve' ? '記事を承認しました' : '記事を却下しました')
      router.refresh()
    } else {
      toast.error('操作に失敗しました')
    }
  }

  return (
    <div className="space-y-3">
      {mode === 'edit' && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">タイトル</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ブリーフ</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          {initDraft && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ドラフト</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y font-mono"
                rows={10}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={loading !== null} onClick={() => act('approve')}>
          {loading === 'approve' ? '...' : mode === 'edit' ? '編集して承認' : '承認'}
        </Button>
        <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => act('reject')}>
          {loading === 'reject' ? '...' : '却下'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setMode((m) => m === 'edit' ? 'view' : 'edit'); setTitle(initTitle); setBrief(initBrief); setDraft(initDraft ?? '') }}
        >
          {mode === 'edit' ? <><X className="mr-1 h-3 w-3" />キャンセル</> : <><Pencil className="mr-1 h-3 w-3" />編集</>}
        </Button>
        {sections.length > 0 && (
          <RewriteSectionDialog
            articleId={articleId}
            sections={sections}
            onApply={handleSectionRewrite}
          />
        )}
      </div>
    </div>
  )
}
