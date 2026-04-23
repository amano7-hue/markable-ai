'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!propertyId.trim()) return
    setLoading(true)

    const res = await fetch('/api/ga4/connect', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: propertyId.trim() }),
    })

    setLoading(false)
    if (res.ok) {
      toast.success('プロパティ ID を保存しました')
      router.refresh()
    } else {
      toast.error('保存に失敗しました')
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
      <Button type="submit" disabled={disabled || loading} className="w-full">
        {loading ? '保存中...' : '保存する'}
      </Button>
    </form>
  )
}
