'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'

type Props = {
  projectId: string
  initialDecorationRules: string
  initialLineBreakRules: string
}

export default function WritingRulesForm({ projectId, initialDecorationRules, initialLineBreakRules }: Props) {
  const [decorationRules, setDecorationRules] = useState(initialDecorationRules)
  const [lineBreakRules, setLineBreakRules] = useState(initialLineBreakRules)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    const res = await fetch('/api/seo/brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, decorationRules, lineBreakRules }),
    })
    setLoading(false)
    if (res.ok) toast.success('ライティングルールを保存しました')
    else toast.error('保存に失敗しました')
  }

  return (
    <div className="space-y-8">
      {/* 装飾ルール */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">HTML装飾ルール</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            記事生成時に適用するHTMLタグによる装飾のルールを1行1ルールで記述します
          </p>
        </div>
        <Textarea
          value={decorationRules}
          onChange={(e) => setDecorationRules(e.target.value)}
          placeholder={[
            '例:',
            '- 重要なキーワードや専門用語は <strong> タグで強調する',
            '- 注意事項・警告は <em> タグで斜体にする',
            '- 製品名・サービス名・固有名詞は <b> タグで太字にする',
            '- 数字・統計データは <strong> タグで目立たせる',
          ].join('\n')}
          rows={7}
          className="font-mono text-sm"
        />
      </div>

      <Separator />

      {/* 改行ルール */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">改行・段落ルール</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            段落の区切り方・文の長さ・改行のタイミングに関するルールを記述します
          </p>
        </div>
        <Textarea
          value={lineBreakRules}
          onChange={(e) => setLineBreakRules(e.target.value)}
          placeholder={[
            '例:',
            '- 1段落は3〜4文以内に収める',
            '- 1文は60文字以内を目安にする',
            '- 箇条書きの前後には必ず空の <p> を入れる',
            '- リード文は2〜3文で完結させる',
            '- 長い説明が続く場合は小見出し（<h3>）で区切る',
          ].join('\n')}
          rows={7}
          className="font-mono text-sm"
        />
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? '保存中...' : '保存'}
      </Button>
    </div>
  )
}
