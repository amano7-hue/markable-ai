'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const GOALS = [
  '初回接触',
  '商談化促進',
  '失注後フォロー',
  '事例紹介',
  '機能アップデート',
]

export default function GenerateEmailButton({ segmentId }: { segmentId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!goal) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/nurturing/emails/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segmentId, goal }),
    })

    setLoading(false)

    if (res.ok) {
      setOpen(false)
      router.push('/dashboard/nurturing/emails')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '生成に失敗しました')
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        メールを生成
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>メールドラフト生成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="goal">メールの目的</Label>
              <Select onValueChange={(v) => setGoal(v as string)}>
                <SelectTrigger id="goal">
                  <SelectValue placeholder="目的を選択" />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              キャンセル
            </Button>
            <Button onClick={handleGenerate} disabled={loading || !goal}>
              {loading ? '生成中...' : 'AI で生成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
