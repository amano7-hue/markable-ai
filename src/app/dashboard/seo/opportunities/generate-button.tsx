'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function GenerateButton({
  keywordId,
  keyword,
}: {
  keywordId: string
  keyword: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(`${keyword}について`)
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)

    const res = await fetch('/api/seo/articles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywordId, title }),
    })

    setLoading(false)
    if (res.ok) {
      toast.success('記事ドラフトを承認キューに追加しました')
      setOpen(false)
      router.refresh()
    } else {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? 'エラーが発生しました')
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        記事を生成
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-7 w-48 text-xs"
      />
      <Button size="sm" disabled={loading} onClick={handleGenerate}>
        {loading ? '生成中...' : '生成'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        キャンセル
      </Button>
    </div>
  )
}
