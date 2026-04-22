'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/seo/articles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywordId, title }),
    })

    if (res.ok) {
      setDone(true)
      router.refresh()
    } else {
      const json = await res.json()
      setError(json.error ?? 'エラーが発生しました')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <span className="text-xs text-green-600">
        生成済み →{' '}
        <a href="/dashboard/seo/articles" className="underline">
          記事ドラフト
        </a>
      </span>
    )
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
