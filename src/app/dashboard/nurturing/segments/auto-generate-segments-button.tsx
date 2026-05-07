'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Check, Loader2, Wand2 } from 'lucide-react'

export default function AutoGenerateSegmentsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<{ created: string[]; skipped: string[] } | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/nurturing/icp-config/generate-segments', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'セグメント生成に失敗しました')
        return
      }
      setResult(data.data)
      setOpen(true)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        ターゲットから自動生成
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>セグメント自動生成 完了</DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-3 py-1">
              {result.created.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">作成したセグメント</p>
                  <ul className="space-y-1">
                    {result.created.map((name) => (
                      <li key={name} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">新たに作成されたセグメントはありません</p>
              )}
              {result.skipped.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  スキップ（同名が既存）: {result.skipped.join('、')}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
