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
import { Sparkles, FlaskConical } from 'lucide-react'

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
  const [mode, setMode] = useState<'single' | 'ab'>('single')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!goal) return
    setLoading(true)
    setError(null)

    const endpoint =
      mode === 'ab'
        ? '/api/nurturing/emails/generate-ab'
        : '/api/nurturing/emails/generate'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segmentId, goal }),
    })

    setLoading(false)

    if (res.ok) {
      setOpen(false)
      router.push('/dashboard/approval?module=nurturing&status=PENDING')
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
              <Select onValueChange={(v) => { if (v !== null) setGoal(String(v)) }}>
                <SelectTrigger id="goal">
                  <SelectValue placeholder="目的を選択" />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 生成モード */}
            <div className="space-y-2">
              <Label>生成モード</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={[
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors text-left',
                    mode === 'single'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent',
                  ].join(' ')}
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">通常生成</p>
                    <p className="text-xs text-muted-foreground">1バリアント</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('ab')}
                  className={[
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors text-left',
                    mode === 'ab'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent',
                  ].join(' ')}
                >
                  <FlaskConical className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">A/B テスト</p>
                    <p className="text-xs text-muted-foreground">2バリアント比較</p>
                  </div>
                </button>
              </div>
              {mode === 'ab' && (
                <p className="text-xs text-muted-foreground">
                  「直接的・簡潔」と「質問形式・感情訴求」の2パターンを生成します。
                  承認キューでどちらを採用するか選択できます。
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              キャンセル
            </Button>
            <Button onClick={handleGenerate} disabled={loading || !goal}>
              {loading ? '生成中...' : mode === 'ab' ? 'A/B で生成' : 'AI で生成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
