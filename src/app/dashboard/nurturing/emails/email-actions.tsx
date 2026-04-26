'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Pencil, X } from 'lucide-react'

interface Props {
  draftId: string
  subject: string
  body: string
}

export default function EmailActions({ draftId, subject: initSubject, body: initBody }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [subject, setSubject] = useState(initSubject)
  const [body, setBody] = useState(initBody)

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    const hasEdits = subject !== initSubject || body !== initBody
    const res = await fetch(`/api/nurturing/emails/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        ...(hasEdits ? { subject, emailBody: body } : {}),
      }),
    })
    setLoading(null)
    if (res.ok) {
      toast.success(action === 'approve' ? 'メールを承認しました' : 'メールを却下しました')
      router.refresh()
    } else {
      toast.error('操作に失敗しました')
    }
  }

  return (
    <div className="space-y-3">
      {mode === 'edit' && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">件名</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={1}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">本文</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={loading !== null} onClick={() => act('approve')}>
          {loading === 'approve' ? '...' : mode === 'edit' ? '編集して承認' : '承認'}
        </Button>
        <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => act('reject')}>
          {loading === 'reject' ? '...' : '却下'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setMode((m) => m === 'edit' ? 'view' : 'edit'); setSubject(initSubject); setBody(initBody) }}
        >
          {mode === 'edit' ? <><X className="mr-1 h-3 w-3" />キャンセル</> : <><Pencil className="mr-1 h-3 w-3" />編集</>}
        </Button>
      </div>
    </div>
  )
}
