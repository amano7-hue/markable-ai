'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function ApproveButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    await fetch('/api/approval', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    })
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={loading !== null}
        onClick={() => act('approve')}
      >
        {loading === 'approve' ? '...' : '承認'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={loading !== null}
        onClick={() => act('reject')}
      >
        {loading === 'reject' ? '...' : '却下'}
      </Button>
    </div>
  )
}
