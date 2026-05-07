'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Pencil, Check, X, ExternalLink, FolderOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type Project = {
  id: string
  name: string
  slug: string
  ownDomain: string | null
  isDefault: boolean
  createdAt: Date
}

export default function ProjectList({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDomain, setEditDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function startEdit(p: Project) {
    setEditingId(p.id)
    setEditName(p.name)
    setEditDomain(p.ownDomain ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, ownDomain: editDomain }),
    })
    setSaving(false)
    if (res.ok) {
      const data = (await res.json()).data as Project
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
      setEditingId(null)
      toast.success('保存しました')
      router.refresh()
    } else {
      toast.error('保存に失敗しました')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？このプロジェクトのすべてのデータが削除されます。`)) return
    setDeletingId(id)
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id))
      toast.success('削除しました')
      router.refresh()
    } else {
      const data = await res.json()
      toast.error(data.error ?? '削除に失敗しました')
    }
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {projects.map((p) => (
        <div key={p.id} className="flex items-center gap-3 px-4 py-3">
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />

          {editingId === p.id ? (
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="プロジェクト名"
                className="h-7 text-sm w-40"
              />
              <Input
                value={editDomain}
                onChange={(e) => setEditDomain(e.target.value)}
                placeholder="example.com"
                className="h-7 text-sm w-44"
              />
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.isDefault && (
                  <Badge variant="secondary" className="text-xs py-0">デフォルト</Badge>
                )}
              </div>
              {p.ownDomain && (
                <p className="text-xs text-muted-foreground">{p.ownDomain}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {editingId === p.id ? (
              <>
                <button
                  type="button"
                  onClick={() => saveEdit(p.id)}
                  disabled={saving || !editName.trim()}
                  className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <a
                  href={`/dashboard/p/${p.id}/llmo`}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="開く"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!p.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deletingId === p.id}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
