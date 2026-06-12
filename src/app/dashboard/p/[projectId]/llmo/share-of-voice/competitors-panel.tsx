'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'

type Competitor = { id: string; domain: string }

type Props = {
  projectId: string
  initialCompetitors: Competitor[]
}

export default function CompetitorsPanel({ projectId, initialCompetitors }: Props) {
  const router = useRouter()
  const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors)
  const [domain, setDomain] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!domain.trim()) return
    setAdding(true)
    setError(null)

    const res = await fetch(`/api/p/${projectId}/llmo/project-competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'エラーが発生しました')
      setAdding(false)
      return
    }

    setCompetitors((prev) => [...prev, data.data])
    setDomain('')
    setAdding(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/p/${projectId}/llmo/project-competitors?id=${id}`, { method: 'DELETE' })
    setCompetitors((prev) => prev.filter((c) => c.id !== id))
    setDeleting(null)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">追跡する競合ドメイン</CardTitle>
        <CardDescription>
          ここで設定したドメインは Share of Voice レポートに常に表示されます。
          URL ではなくドメイン名（例: competitor.com）を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="例: competitor.com"
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={adding || !domain.trim()}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {adding ? '追加中...' : '追加'}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">競合ドメインが登録されていません</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border">
            {competitors.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-mono">{c.domain}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={deleting === c.id}
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {competitors.length > 0 && (
          <p className="text-xs text-muted-foreground">
            ※ 競合の引用データは次回スナップショット取得時から反映されます
          </p>
        )}
      </CardContent>
    </Card>
  )
}
