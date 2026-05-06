'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

type Props = {
  name: string
  ownDomain: string | null
  slackWebhookUrl: string | null
}

export default function SettingsForm({ name, ownDomain, slackWebhookUrl }: Props) {
  const [form, setForm] = useState({
    name,
    ownDomain: ownDomain ?? '',
    slackWebhookUrl: slackWebhookUrl ?? '',
  })
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        ownDomain: form.ownDomain.trim(),
        slackWebhookUrl: form.slackWebhookUrl.trim(),
      }),
    })

    setLoading(false)
    if (res.ok) {
      toast.success('設定を保存しました')
    } else {
      toast.error('保存に失敗しました')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">会社名</Label>
        <Input
          id="name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="株式会社〇〇"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownDomain">自社ドメイン</Label>
        <Input
          id="ownDomain"
          name="ownDomain"
          value={form.ownDomain}
          onChange={handleChange}
          placeholder="example.com"
        />
        <p className="text-xs text-muted-foreground">
          LLMO の引用ギャップ検出に使用します。プロトコルなしで入力してください（例: example.com）
        </p>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="slackWebhookUrl">Slack Webhook URL</Label>
        <Input
          id="slackWebhookUrl"
          name="slackWebhookUrl"
          type="url"
          value={form.slackWebhookUrl}
          onChange={handleChange}
          placeholder="https://hooks.slack.com/services/..."
        />
        <p className="text-xs text-muted-foreground">
          承認待ちアイテムが 3 日以上滞留した場合に通知します。
          Slack の Incoming Webhook URL を設定してください。
        </p>
      </div>

      <Button type="submit" disabled={loading || !form.name.trim()}>
        {loading ? '保存中...' : '保存'}
      </Button>
    </form>
  )
}
