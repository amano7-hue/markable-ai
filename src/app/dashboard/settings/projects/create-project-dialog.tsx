'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function CreateProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [ownDomain, setOwnDomain] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ownDomain: ownDomain || undefined }),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      toast.success(`「${name}」を作成しました`)
      setOpen(false)
      setName('')
      setOwnDomain('')
      router.push(`/dashboard/p/${data.data.id}/llmo`)
      router.refresh()
    } else {
      const data = await res.json()
      toast.error(data.error ?? '作成に失敗しました')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">
        <Plus className="h-3.5 w-3.5" />
        プロジェクトを追加
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>新しいプロジェクト</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>プロジェクト名 <span className="text-destructive">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: コーポレートサイト"
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label>自社ドメイン（省略可）</Label>
            <Input
              value={ownDomain}
              onChange={(e) => setOwnDomain(e.target.value)}
              placeholder="example.com"
            />
            <p className="text-xs text-muted-foreground">LLMO の引用検出で使用します</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />作成中...</> : '作成'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
