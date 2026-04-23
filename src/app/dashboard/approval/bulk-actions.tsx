'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Props {
  pendingCount: number
  module?: string
}

export default function BulkActions({ pendingCount, module }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (pendingCount === 0) return null

  async function bulkApprove() {
    setLoading(true)
    try {
      const res = await fetch('/api/approval/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', module }),
      })
      const data = (await res.json()) as { updated?: number }
      if (res.ok) {
        toast.success(`${data.updated ?? 0} 件を承認しました`)
        router.refresh()
      } else {
        toast.error('一括承認に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        disabled={loading}
      >
        {loading ? '処理中...' : `承認待ち ${pendingCount} 件を一括承認`}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>一括承認の確認</AlertDialogTitle>
          <AlertDialogDescription>
            {module
              ? `${module.toUpperCase()} モジュールの承認待ち ${pendingCount} 件をすべて承認します。`
              : `承認待ち ${pendingCount} 件をすべて承認します。`}
            この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={bulkApprove}>一括承認する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
