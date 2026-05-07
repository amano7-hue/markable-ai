'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

export default function DeleteKnowledgeButton({ sourceId, title }: { sourceId: string; title: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`「${title}」を削除しますか？`)) return
    setLoading(true)
    const res = await fetch(`/api/seo/knowledge/${sourceId}`, { method: 'DELETE' })
    setLoading(false)
    if (res.ok) {
      toast.success('削除しました')
      router.refresh()
    } else {
      toast.error('削除に失敗しました')
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
