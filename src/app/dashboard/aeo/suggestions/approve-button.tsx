'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Pencil, X } from 'lucide-react'

interface Props {
  id: string
  suggestion: string
}

export default function ApproveButton({ id, suggestion: initialSuggestion }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [suggestion, setSuggestion] = useState(initialSuggestion)

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    const hasEdits = suggestion !== initialSuggestion
    const res = await fetch('/api/approval', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        action,
        ...(hasEdits ? { edits: { suggestion } } : {}),
      }),
    })
    setLoading(null)
    if (res.ok) {
      toast.success(action === 'approve' ? '改善提案を承認しました' : '却下しました')
      router.refresh()
    } else {
      toast.error('操作に失敗しました')
    }
  }

  return (
    <div className="space-y-3">
      {mode === 'edit' && (
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          rows={6}
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
        />
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
          onClick={() => { setMode((m) => m === 'edit' ? 'view' : 'edit'); setSuggestion(initialSuggestion) }}
        >
          {mode === 'edit' ? <><X className="mr-1 h-3 w-3" />キャンセル</> : <><Pencil className="mr-1 h-3 w-3" />編集</>}
        </Button>
      </div>
    </div>
  )
}
