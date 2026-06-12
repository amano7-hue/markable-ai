'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Trash2, Plus } from 'lucide-react'

type PendingTenant = {
  id: string
  email: string
  companyName: string
  createdAt: Date | string
  usedAt: Date | string | null
}

type Props = {
  initialList: PendingTenant[]
}

export default function PendingTenantList({ initialList }: Props) {
  const [list, setList] = useState<PendingTenant[]>(initialList)
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)

    const res = await fetch('/api/admin/pending-tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, companyName }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'エラーが発生しました')
      setAdding(false)
      return
    }

    setList((prev) => [data.data, ...prev])
    setEmail('')
    setCompanyName('')
    setAdding(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/admin/pending-tenants?id=${id}`, { method: 'DELETE' })
    setList((prev) => prev.filter((p) => p.id !== id))
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      {/* 追加フォーム */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">新規メンバーを招待</CardTitle>
          <CardDescription>メールアドレスと会社名を登録すると、そのユーザーがアカウント作成できるようになります。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="companyName">会社名</Label>
                <Input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="株式会社〇〇"
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={adding} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              {adding ? '登録中...' : '登録'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">登録済みメンバー</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">まだ登録されていません</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.email}</p>
                    <p className="text-xs text-muted-foreground">{item.companyName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={
                        item.usedAt
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs'
                          : 'text-xs'
                      }
                    >
                      {item.usedAt ? '登録済み' : '未使用'}
                    </Badge>
                    {!item.usedAt && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={deleting === item.id}
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        ※ 登録済み（テナント作成完了）のメンバーは削除できません。
      </p>
    </div>
  )
}
