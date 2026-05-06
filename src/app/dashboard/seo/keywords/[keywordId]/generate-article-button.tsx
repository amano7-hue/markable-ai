'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function GenerateArticleButton({
  keywordId,
  keyword,
}: {
  keywordId: string
  keyword: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(`${keyword}について`)
  const [ownInsights, setOwnInsights] = useState('')

  async function handleGenerate() {
    setLoading(true)
    const res = await fetch('/api/seo/articles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywordId,
        title,
        ownInsights: ownInsights.trim() || undefined,
      }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success('記事ドラフトを承認キューに追加しました')
      setOpen(false)
      setOwnInsights('')
    } else {
      const json = await res.json().catch(() => ({})) as { error?: string }
      toast.error(json.error ?? 'エラーが発生しました')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
        <Sparkles className="h-3 w-3" />
        記事を生成
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>記事ドラフトを生成</DialogTitle>
          <DialogDescription>
            AIが読者ニーズ分析・競合調査・見出し設計を行い、記事を生成します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>記事タイトル</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="記事のタイトルを入力"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              独自データ・事例
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">任意</span>
            </Label>
            <Textarea
              value={ownInsights}
              onChange={(e) => setOwnInsights(e.target.value)}
              placeholder={`記事に含めたい独自情報を自由に記載してください。

例:
・弊社調査（n=200社）では、導入後3ヶ月でリード獲得数が平均42%増加
・製造業A社では、本施策を導入後6ヶ月で商談数が2.3倍に
・業界平均のCVRが1.2%に対し、弊社顧客の平均は3.8%を達成`}
              rows={6}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              数字・事例・独自の知見を入力すると、他社記事と差別化された独自性の高い記事になります
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              キャンセル
            </Button>
            <Button onClick={handleGenerate} disabled={loading || !title.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  生成する
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
