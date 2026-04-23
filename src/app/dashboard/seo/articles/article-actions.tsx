'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function ArticleActions({ articleId }: { articleId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    const res = await fetch(`/api/seo/articles/${articleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setLoading(null)
    if (res.ok) {
      toast.success(action === 'approve' ? '記事を承認しました' : '記事を却下しました')
      router.refresh()
    } else {
      toast.error('操作に失敗しました')
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={loading !== null} onClick={() => act('approve')}>
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
