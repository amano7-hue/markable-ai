'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SiteUrlForm({ currentSiteUrl }: { currentSiteUrl: string }) {
  const [siteUrl, setSiteUrl] = useState(currentSiteUrl)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!siteUrl.trim()) return
    setLoading(true)
    setMessage(null)

    const res = await fetch('/api/seo/connect', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteUrl: siteUrl.trim() }),
    })

    if (res.ok) {
      setMessage({ type: 'success', text: 'サイト URL を更新しました' })
    } else {
      const data = await res.json()
      setMessage({ type: 'error', text: data.error ?? '更新に失敗しました' })
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="siteUrl">サイト URL</Label>
        <Input
          id="siteUrl"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://www.example.com/"
          required
        />
        <p className="text-xs text-muted-foreground">
          GSC で認証されているプロパティの URL を入力してください。
        </p>
      </div>
      {message && (
        <p className={`text-xs ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
          {message.text}
        </p>
      )}
      <Button type="submit" size="sm" disabled={loading || !siteUrl.trim()}>
        {loading ? '更新中...' : '更新'}
      </Button>
    </form>
  )
}
