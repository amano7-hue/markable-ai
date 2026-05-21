'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
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

export default function DeleteArticleButton({ articleId, title }: { articleId: string; title: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/seo/articles/${articleId}`, { method: 'DELETE' })
    setLoading(false)
    if (res.ok) {
      toast.success('記事を削除しました')
      router.refresh()
    } else {
      toast.error('削除に失敗しました')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={loading} type="button">
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          削除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>記事を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            「{title}」を削除します。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? '削除中...' : '削除する'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
