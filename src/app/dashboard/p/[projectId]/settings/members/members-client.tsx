'use client'

import { useState } from 'react'
import { UserPlus, Trash2, Clock, Copy, Check, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProjectRole } from '@/generated/prisma'

type Member = {
  id: string
  role: ProjectRole
  user: { id: string; name: string | null; email: string; role: string }
}

type PendingInvite = {
  id: string
  email: string | null
  role: ProjectRole
  token: string
  expiresAt: Date | string
}

type Props = {
  projectId: string
  members: Member[]
  pendingInvites: PendingInvite[]
  canManage: boolean
}

export default function MembersClient({
  projectId,
  members: initialMembers,
  pendingInvites: initialInvites,
  canManage,
}: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [pendingInvites, setPendingInvites] = useState(initialInvites)
  const [role, setRole] = useState<ProjectRole>('VIEWER')
  const [generating, setGenerating] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setGeneratedLink(null)

    const res = await fetch(`/api/projects/${projectId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const data = await res.json()

    if (res.ok) {
      setGeneratedLink(data.inviteUrl)
      setPendingInvites((prev) => [
        { id: data.token, email: null, role: data.role, token: data.token, expiresAt: data.expiresAt },
        ...prev,
      ])
    } else {
      setError(data.error ?? 'エラーが発生しました')
    }
    setGenerating(false)
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevokeInvite(token: string) {
    const res = await fetch(`/api/projects/${projectId}/invites`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      setPendingInvites((prev) => prev.filter((inv) => inv.token !== token))
      if (generatedLink?.includes(token)) setGeneratedLink(null)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('このメンバーをプロジェクトから削除しますか？')) return
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    }
  }

  const roleLabel = (r: ProjectRole) => (r === 'EDITOR' ? '編集者' : '閲覧者')

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="space-y-6">
      {/* 招待リンク生成 */}
      {canManage && (
        <div className="rounded border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" />
            招待リンクを生成
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value as ProjectRole); setGeneratedLink(null) }}
              className="rounded border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="VIEWER">閲覧者</option>
              <option value="EDITOR">編集者</option>
            </select>
            <Button onClick={handleGenerate} disabled={generating} size="sm" variant="outline">
              <Link className="h-3.5 w-3.5 mr-1.5" />
              {generating ? '生成中...' : 'リンクを生成'}
            </Button>
          </div>

          {generatedLink && (
            <div className="rounded border border-border bg-muted/40 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">このリンクを相手に送ってください（7日間有効）</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs bg-background rounded border border-border px-2 py-1.5">
                  {generatedLink}
                </code>
                <button
                  onClick={() => handleCopy(generatedLink)}
                  className="shrink-0 rounded border border-border bg-background p-1.5 hover:bg-accent transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {/* メンバー一覧 */}
      <div>
        <h2 className="mb-2 text-sm font-medium">メンバー ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">まだメンバーがいません</p>
        ) : (
          <div className="divide-y divide-border rounded border border-border bg-card">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.user.name ?? m.user.email}</p>
                  {m.user.name && (
                    <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                  )}
                </div>
                <div className="ml-3 flex items-center gap-2 shrink-0">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {roleLabel(m.role)}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 有効な招待リンク一覧 */}
      {canManage && pendingInvites.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            有効な招待リンク ({pendingInvites.length})
          </h2>
          <div className="divide-y divide-border rounded border border-border bg-card">
            {pendingInvites.map((inv) => (
              <div key={inv.token} className="flex items-center justify-between px-4 py-3 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={() => handleCopy(`${appUrl}/invite/${inv.token}`)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent transition-colors"
                    title="リンクをコピー"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
                    {roleLabel(inv.role)}
                  </span>
                  <p className="text-xs text-muted-foreground truncate">
                    期限: {new Date(inv.expiresAt).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <button
                  onClick={() => handleRevokeInvite(inv.token)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="招待を取り消す"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
