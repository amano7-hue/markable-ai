'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Ga4PropertyForm({
  disabled,
  currentPropertyId,
}: {
  disabled: boolean
  currentPropertyId: string
}) {
  const router = useRouter()
  const [propertyId, setPropertyId] = useState(currentPropertyId)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!propertyId.trim()) return
    setLoading(true)
    setMessage(null)

    const res = await fetch('/api/ga4/connect', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: propertyId.trim() }),
    })

    setLoading(false)
    if (res.ok) {
      setMessage('保存しました')
      router.refresh()
    } else {
      setMessage('保存に失敗しました')
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="propertyId">プロパティ ID</Label>
        <Input
          id="propertyId"
          placeholder="例: 123456789"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          disabled={disabled}
          required
        />
      </div>
      {message && (
        <p className={`text-sm ${message.includes('失敗') ? 'text-destructive' : 'text-green-600'}`}>
          {message}
        </p>
      )}
      <Button type="submit" disabled={disabled || loading} className="w-full">
        {loading ? '保存中...' : '保存する'}
      </Button>
    </form>
  )
}
