'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Check } from 'lucide-react'

type Props = {
  promptId: string
  domain: string
  initialRegistered: boolean
}

export default function GapRegisterCompetitorButton({ promptId, domain, initialRegistered }: Props) {
  const [registered, setRegistered] = useState(initialRegistered)
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    setLoading(true)
    const res = await fetch(`/api/llmo/prompts/${promptId}/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
    setLoading(false)

    if (res.ok || res.status === 409) {
      setRegistered(true)
      toast.success(`${domain} を競合に登録しました`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '登録に失敗しました')
    }
  }

  if (registered) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Check className="h-3 w-3" />
        登録済み
      </span>
    )
  }

  return (
    <button
      onClick={handleRegister}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      <PlusCircle className="h-3 w-3" />
      {loading ? '登録中...' : '競合に登録'}
    </button>
  )
}
