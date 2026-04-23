'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Competitor = { id: string; domain: string }

type Props = {
  promptId: string
  initialCompetitors: Competitor[]
}

export default function CompetitorManager({ promptId, initialCompetitors }: Props) {
  const [competitors, setCompetitors] = useState(initialCompetitors)
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = domain.trim()
    if (!trimmed) return
    if (competitors.some((c) => c.domain === trimmed)) {
      setError('このドメインはすでに登録されています')
      return
    }

    setLoading(true)
    setError(null)

    const res = await fetch(`/api/aeo/prompts/${promptId}/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: trimmed }),
    })

    if (res.ok) {
      const added = await res.json()
      setCompetitors((prev) => [...prev, added])
      setDomain('')
    } else {
      const data = await res.json()
      setError(data.error ?? '追加に失敗しました')
    }
    setLoading(false)
  }

  async function handleRemove(competitor: Competitor) {
    setRemoving(competitor.id)

    const res = await fetch(`/api/aeo/prompts/${promptId}/competitors`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: competitor.domain }),
    })

    if (res.ok) {
      setCompetitors((prev) => prev.filter((c) => c.id !== competitor.id))
    }
    setRemoving(null)
  }

  return (
    <div className="space-y-3">
      {competitors.length === 0 ? (
        <p className="text-sm text-muted-foreground">競合未設定</p>
      ) : (
        <ul className="space-y-1">
          {competitors.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <span className="font-mono">{c.domain}</span>
              <button
                onClick={() => handleRemove(c)}
                disabled={removing === c.id}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                {removing === c.id ? '削除中...' : '削除'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="competitor.com"
          className="h-8 text-sm font-mono"
        />
        <Button type="submit" size="sm" disabled={loading || !domain.trim()}>
          {loading ? '追加中...' : '追加'}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
