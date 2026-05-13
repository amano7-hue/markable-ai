'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { RefreshCw, Pencil, X, Check } from 'lucide-react'

interface Props {
  tableId: string
  articleId: string
  title: string
  htmlContent: string
}

export default function ArticleTable({ tableId, articleId, title: initialTitle, htmlContent: initialHtml }: Props) {
  const [html, setHtml] = useState(initialHtml)
  const [title, setTitle] = useState(initialTitle)
  const [editing, setEditing] = useState(false)
  const [editHtml, setEditHtml] = useState(initialHtml)
  const [editTitle, setEditTitle] = useState(initialTitle)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/seo/articles/${articleId}/tables/${tableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ htmlContent: editHtml, title: editTitle }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('保存に失敗しました'); return }
    setHtml(editHtml)
    setTitle(editTitle)
    setEditing(false)
    toast.success('表を保存しました')
  }

  async function handleRegenerate() {
    setRegenerating(true)
    const res = await fetch(`/api/seo/articles/${articleId}/tables/${tableId}/regenerate`, { method: 'POST' })
    setRegenerating(false)
    if (!res.ok) { toast.error('再生成に失敗しました'); return }
    const d = await res.json()
    setHtml(d.htmlContent)
    setTitle(d.title)
    toast.success('表を再生成しました')
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">📋 {title}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setEditHtml(html); setEditTitle(title) }} disabled={editing || regenerating}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={regenerating || editing}>
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="p-3 space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">キャプション</Label>
            <input
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">HTML</Label>
            <Textarea
              value={editHtml}
              onChange={(e) => setEditHtml(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave}><Check className="mr-1 h-3.5 w-3.5" />保存</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="mr-1 h-3.5 w-3.5" />キャンセル</Button>
          </div>
        </div>
      ) : (
        <div className="p-3 overflow-x-auto prose prose-sm dark:prose-invert max-w-none [&_table]:w-full [&_th]:bg-muted [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm">
          <div dangerouslySetInnerHTML={{ __html: html }} />
          <p className="mt-1.5 text-center text-xs text-muted-foreground">{title}</p>
        </div>
      )}
    </div>
  )
}
