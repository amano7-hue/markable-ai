'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function CancellationForm({ alreadyRequested }: { alreadyRequested: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(alreadyRequested)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/settings/cancellation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    })

    setLoading(false)

    if (res.ok) {
      setSubmitted(true)
      setOpen(false)
      toast.success('解約申請を受け付けました。担当者よりご連絡いたします。')
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '申請に失敗しました')
    }
  }

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        解約申請は受け付け済みです。担当者より順次ご連絡いたします。
      </p>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          解約を申請する
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>解約申請</DialogTitle>
          <DialogDescription>
            解約申請を送信すると、担当者よりご連絡いたします。
            申請後もデータは即時削除されません。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">解約理由（任意）</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: 利用を終了するため、他のツールに移行するため"
              rows={4}
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? '送信中...' : '解約申請を送信'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
