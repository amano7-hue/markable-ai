'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HubSpotConnectForm({ isConnected }: { isConnected: boolean }) {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return

    setLoading(true)
    setError(null)

    const res = await fetch('/api/nurturing/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    })

    setLoading(false)

    if (res.ok) {
      router.push('/dashboard/nurturing/connect?connected=1')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '接続に失敗しました')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isConnected ? 'API キーを更新' : 'HubSpot に接続'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Private App トークン</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              HubSpot の「設定 → インテグレーション → Private Apps」から取得できます。
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '接続中...' : isConnected ? '更新する' : '接続する'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
