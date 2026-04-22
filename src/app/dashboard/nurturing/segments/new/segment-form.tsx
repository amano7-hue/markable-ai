'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'

const LIFECYCLE_OPTIONS = [
  { value: 'lead', label: 'リード' },
  { value: 'marketingqualifiedlead', label: 'MQL' },
  { value: 'salesqualifiedlead', label: 'SQL' },
  { value: 'opportunity', label: '商談' },
  { value: 'customer', label: '顧客' },
]

export default function SegmentForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedLifecycle, setSelectedLifecycle] = useState<string[]>([])
  const [minIcpScore, setMinIcpScore] = useState('')
  const [company, setCompany] = useState('')

  function toggleLifecycle(value: string) {
    setSelectedLifecycle((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const criteria: Record<string, unknown> = {}
    if (selectedLifecycle.length > 0) criteria.lifecycle = selectedLifecycle
    if (minIcpScore !== '') criteria.minIcpScore = Number(minIcpScore)
    if (company.trim()) criteria.company = company.trim()

    const res = await fetch('/api/nurturing/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        criteria,
      }),
    })

    setLoading(false)

    if (res.ok) {
      router.push('/dashboard/nurturing/segments')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '作成に失敗しました')
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">セグメント名 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 高スコア MQL"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任意"
            />
          </div>

          <div className="space-y-2">
            <Label>ライフサイクルステージ</Label>
            <div className="space-y-2">
              {LIFECYCLE_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={opt.value}
                    checked={selectedLifecycle.includes(opt.value)}
                    onCheckedChange={() => toggleLifecycle(opt.value)}
                  />
                  <Label htmlFor={opt.value} className="font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minIcpScore">最低 ICP スコア</Label>
            <Input
              id="minIcpScore"
              type="number"
              min={0}
              max={100}
              value={minIcpScore}
              onChange={(e) => setMinIcpScore(e.target.value)}
              placeholder="例: 50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">会社名 (部分一致)</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="例: 株式会社"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? '作成中...' : '作成する'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
