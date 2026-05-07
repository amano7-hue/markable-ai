'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Props = {
  token: string
  projectId: string
}

export default function AcceptButton({ token, projectId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/invite/${token}/accept`, { method: 'POST' })
    const data = await res.json()

    if (res.ok) {
      router.push(`/dashboard/p/${data.projectId}/llmo`)
    } else {
      setError(data.error ?? 'エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleAccept}
        disabled={loading}
        className="w-full"
      >
        {loading ? '参加中...' : 'プロジェクトに参加する'}
      </Button>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  )
}
