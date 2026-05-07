'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Trash2, Clock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ProjectRole } from '@/generated/prisma'

type Member = {
  id: string
  role: ProjectRole
  user: { id: string; name: string | null; email: string; role: string }
}

type PendingInvite = {
  id: string
  email: string
  role: ProjectRole
  expiresAt: Date
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
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [pendingInvites, setPendingInvites] = useState(initialInvites)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectRole>('VIEWER')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setMessage(null)

    const res = await fetch(`/api/projects/${projectId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })
    const data = await res.json()

    if (res.ok) {
      setMessage({ type: 'ok', text: data.added ? `${data.email} をメンバーに追加しました` : `${data.email} に招待メールを送信しました` })
      setEmail('')
      router.refresh()
    } else {
      setMessage({ type: 'err', text: data.error ?? 'エラーが発生しました' })
    }
    setSending(false)
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

  return (
    <div className="space-y-6">
      {/* 招待フォーム */}
      {canManage && (
        <div className="rounded border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" />
            メンバーを招待
          </h2>
          <form onSubmit={handleInvite} className="flex gap-2">
            <Input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 text-sm"
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectRole)}
              className="rounded border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="VIEWER">閲覧者</option>
              <option value="EDITOR">編集者</option>
            </select>
            <Button type="submit" disabled={sending} size="sm">
              {sending ? '送信中...' : '招待'}
            </Button>
          </form>
          {message && (
            <p className={`mt-2 text-xs ${message.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>
              {message.text}
            </p>
          )}
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

      {/* 招待待ち */}
      {canManage && pendingInvites.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            招待待ち ({pendingInvites.length})
          </h2>
          <div className="divide-y divide-border rounded border border-border bg-card">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-sm truncate">{inv.email}</p>
                </div>
                <span className="ml-3 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {roleLabel(inv.role)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
