'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function SuggestButton({ promptId }: { promptId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/aeo/prompts/${promptId}/suggest`, {
      method: 'POST',
    })
    if (res.ok) {
      setDone(true)
    } else {
      const json = await res.json()
      setError(json.error ?? 'エラーが発生しました')
    }
    setLoading(false)
  }

  if (done) return <p className="text-sm text-green-600">改善提案を承認キューに追加しました</p>

  return (
    <div className="space-y-1">
      <Button onClick={handleClick} disabled={loading} variant="secondary">
        {loading ? '生成中...' : '改善提案を生成'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
