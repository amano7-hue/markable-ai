'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react'

interface CtaBlock {
  id: string
  shortcode: string
  label: string
  content: string
  isActive: boolean
}

type Project = { id: string; name: string; slug: string; ownDomain: string | null }

const GB_PLACEHOLDER = `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons">
  <!-- wp:button {"backgroundColor":"primary","textColor":"white"} -->
  <div class="wp-block-button">
    <a class="wp-block-button__link has-white-color has-primary-background-color" href="/contact">
      無料でご相談ください
    </a>
  </div>
  <!-- /wp:button -->
</div>
<!-- /wp:buttons -->`

export default function CtaBlocksManager({
  initialBlocks,
  projectId,
  projects,
}: {
  initialBlocks: CtaBlock[]
  projectId?: string
  projects?: Project[]
}) {
  const router = useRouter()
  const [blocks, setBlocks] = useState(initialBlocks)
  const [adding, setAdding] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editStates, setEditStates] = useState<Record<string, { label: string; content: string }>>({})

  const [newShortcode, setNewShortcode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newProjectId, setNewProjectId] = useState(projectId ?? '')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!newShortcode || !newLabel || !newContent) return
    setSaving(true)
    const effectiveProjectId = newProjectId || projectId
    const res = await fetch('/api/seo/cta-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcode: newShortcode, label: newLabel, content: newContent, projectId: effectiveProjectId }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? '登録に失敗しました')
      return
    }
    const d = await res.json()
    toast.success('CTAブロックを登録しました')
    setNewShortcode(''); setNewLabel(''); setNewContent(''); setAdding(false)
    setBlocks((b) => [...b, { ...d, isActive: true }])
    router.refresh()
  }

  async function handleSave(id: string) {
    const s = editStates[id]
    if (!s) return
    setSaving(true)
    const res = await fetch(`/api/seo/cta-blocks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    })
    setSaving(false)
    if (!res.ok) { toast.error('保存に失敗しました'); return }
    toast.success('保存しました')
    setBlocks((b) => b.map((bl) => bl.id === id ? { ...bl, ...s } : bl))
    setEditStates((e) => { const n = { ...e }; delete n[id]; return n })
    setExpandedId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('このCTAブロックを削除しますか？')) return
    const res = await fetch(`/api/seo/cta-blocks/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('削除に失敗しました'); return }
    toast.success('削除しました')
    setBlocks((b) => b.filter((bl) => bl.id !== id))
  }

  async function handleToggleActive(id: string, value: boolean) {
    setBlocks((b) => b.map((bl) => bl.id === id ? { ...bl, isActive: value } : bl))
    const res = await fetch(`/api/seo/cta-blocks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: value }),
    })
    if (!res.ok) {
      setBlocks((b) => b.map((bl) => bl.id === id ? { ...bl, isActive: !value } : bl))
      toast.error('更新に失敗しました')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        WordPress のグーテンベルグエディターからブロックコードをコピーして貼り付けてください。
        記事承認後に「コピー」すると <code className="font-mono">[cta:ショートコード]</code> がブロックコードに置換されます。
        ONにしたブロックのみ記事生成で自動参照されます。
      </div>

      {/* CTA 一覧 */}
      {blocks.map((block) => {
        const isOpen = expandedId === block.id
        const edit = editStates[block.id]
        return (
          <div key={block.id} className={`rounded-lg border border-border transition-opacity ${!block.isActive ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-primary">[cta:{block.shortcode}]</code>
                <span className="text-sm font-medium truncate">{block.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={block.isActive}
                  onCheckedChange={(v) => handleToggleActive(block.id, v)}
                  aria-label={block.isActive ? '記事生成で使用中' : '記事生成で未使用'}
                />
                <Button
                  variant="ghost" size="sm"
                  onClick={() => {
                    if (isOpen) { setExpandedId(null) }
                    else {
                      setExpandedId(block.id)
                      setEditStates((e) => ({ ...e, [block.id]: { label: block.label, content: block.content } }))
                    }
                  }}
                >
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(block.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {isOpen && edit && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">表示名</Label>
                  <Input value={edit.label} onChange={(e) => setEditStates((s) => ({ ...s, [block.id]: { ...s[block.id], label: e.target.value } }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">グーテンベルグブロックコード</Label>
                  <Textarea
                    value={edit.content}
                    onChange={(e) => setEditStates((s) => ({ ...s, [block.id]: { ...s[block.id], content: e.target.value } }))}
                    rows={10}
                    className="font-mono text-xs resize-y"
                    placeholder={GB_PLACEHOLDER}
                  />
                  <p className="text-xs text-muted-foreground">WordPress のグーテンベルグエディターで作成したブロックを「コードエディター（︙ → コードエディター）」からコピーして貼り付けてください。</p>
                </div>
                <Button size="sm" disabled={saving} onClick={() => handleSave(block.id)}>保存</Button>
              </div>
            )}
          </div>
        )
      })}

      {/* 新規追加 */}
      {adding ? (
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
          {/* プロジェクト選択 */}
          {projects && projects.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">登録先プロジェクト</Label>
              <Select value={newProjectId} onValueChange={(v) => { if (v) setNewProjectId(v) }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="プロジェクトを選択" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}{p.ownDomain ? ` (${p.ownDomain})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">ショートコード <span className="text-destructive">*</span></Label>
              <Input
                value={newShortcode}
                onChange={(e) => setNewShortcode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="contact"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">英小文字・数字・-・_ のみ。記事内で [cta:{newShortcode || 'xxx'}] として挿入されます。</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">表示名 <span className="text-destructive">*</span></Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="お問い合わせCTA" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">グーテンベルグブロックコード <span className="text-destructive">*</span></Label>
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={10}
              className="font-mono text-xs resize-y"
              placeholder={GB_PLACEHOLDER}
            />
            <p className="text-xs text-muted-foreground">
              WordPress のグーテンベルグエディターで作成したブロックを「コードエディター（︙ → コードエディター）」からコピーして貼り付けてください。
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving || !newShortcode || !newLabel || !newContent} onClick={handleAdd}>登録</Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewShortcode(''); setNewLabel(''); setNewContent(''); setNewProjectId(projectId ?? '') }}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          CTAブロックを追加
        </Button>
      )}
    </div>
  )
}
