'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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

export default function DeleteKeywordButton({ keywordId }: { keywordId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/seo/keywords/${keywordId}`, { method: 'DELETE' })
    setLoading(false)
    if (res.ok) {
      toast.success('キーワードを削除しました')
      router.push('/dashboard/seo/keywords')
      router.refresh()
    } else {
      toast.error('削除に失敗しました')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant="outline" size="sm" disabled={loading}>
          削除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>キーワードを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            このキーワードとすべての関連スナップショットが削除されます。この操作は元に戻せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading}>
            {loading ? '削除中...' : '削除する'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
