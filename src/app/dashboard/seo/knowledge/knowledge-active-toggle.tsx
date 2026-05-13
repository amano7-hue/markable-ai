'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'

export default function KnowledgeActiveToggle({
  sourceId,
  isActive,
}: {
  sourceId: string
  isActive: boolean
}) {
  const router = useRouter()
  const [active, setActive] = useState(isActive)
  const [loading, setLoading] = useState(false)

  async function handleToggle(value: boolean) {
    setActive(value)
    setLoading(true)
    const res = await fetch(`/api/seo/knowledge/${sourceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: value }),
    })
    setLoading(false)
    if (!res.ok) {
      setActive(!value)
      toast.error('更新に失敗しました')
      return
    }
    router.refresh()
  }

  return (
    <Switch
      checked={active}
      onCheckedChange={handleToggle}
      disabled={loading}
      aria-label={active ? '記事生成で使用中' : '記事生成で未使用'}
    />
  )
}
