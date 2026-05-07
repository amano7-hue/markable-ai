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
  wpUrl: string | null
  wpUsername: string | null
  wpAppPassword: string | null
  resendFrom: string | null
}

export default function SettingsForm({
  name,
  ownDomain,
  slackWebhookUrl,
  wpUrl,
  wpUsername,
  wpAppPassword,
  resendFrom,
}: Props) {
  const [form, setForm] = useState({
    name,
    ownDomain: ownDomain ?? '',
    slackWebhookUrl: slackWebhookUrl ?? '',
    wpUrl: wpUrl ?? '',
    wpUsername: wpUsername ?? '',
    wpAppPassword: wpAppPassword ?? '',
    resendFrom: resendFrom ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [testingWp, setTestingWp] = useState(false)

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
        wpUrl: form.wpUrl.trim(),
        wpUsername: form.wpUsername.trim(),
        wpAppPassword: form.wpAppPassword.trim(),
        resendFrom: form.resendFrom.trim(),
      }),
    })

    setLoading(false)
    if (res.ok) {
      toast.success('設定を保存しました')
    } else {
      toast.error('保存に失敗しました')
    }
  }

  async function handleTestWp() {
    if (!form.wpUrl || !form.wpUsername || !form.wpAppPassword) {
      toast.error('WordPress URL・ユーザー名・アプリパスワードを入力してください')
      return
    }
    setTestingWp(true)
    const res = await fetch('/api/settings/test-wordpress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wpUrl: form.wpUrl.trim(),
        wpUsername: form.wpUsername.trim(),
        wpAppPassword: form.wpAppPassword.trim(),
      }),
    })
    setTestingWp(false)
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`接続成功: ${data.data?.name ?? 'WordPress'} (${data.data?.url})`)
    } else {
      toast.error(data.error ?? '接続に失敗しました')
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
          LLMO の引用ギャップ検出に使用します（例: example.com）
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
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">WordPress 連携</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            SEO 記事を承認すると WordPress へ自動投稿されます
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wpUrl">WordPress サイト URL</Label>
          <Input
            id="wpUrl"
            name="wpUrl"
            type="url"
            value={form.wpUrl}
            onChange={handleChange}
            placeholder="https://example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wpUsername">ユーザー名</Label>
          <Input
            id="wpUsername"
            name="wpUsername"
            value={form.wpUsername}
            onChange={handleChange}
            placeholder="admin"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wpAppPassword">アプリケーションパスワード</Label>
          <Input
            id="wpAppPassword"
            name="wpAppPassword"
            type="password"
            value={form.wpAppPassword}
            onChange={handleChange}
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
          />
          <p className="text-xs text-muted-foreground">
            WordPress 管理画面 → ユーザー → プロフィール → アプリケーションパスワードで生成できます
          </p>
        </div>
        {(form.wpUrl || form.wpUsername || form.wpAppPassword) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestWp}
            disabled={testingWp}
          >
            {testingWp ? '接続確認中...' : '接続テスト'}
          </Button>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">メール送信 (Resend)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ナーチャリングメールを承認すると自動送信されます。事前に Resend の API キーを環境変数 <code className="text-xs bg-muted px-1 rounded">RESEND_API_KEY</code> に設定してください。
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="resendFrom">送信元メールアドレス</Label>
          <Input
            id="resendFrom"
            name="resendFrom"
            type="email"
            value={form.resendFrom}
            onChange={handleChange}
            placeholder="noreply@example.com"
          />
          <p className="text-xs text-muted-foreground">
            Resend で認証済みのドメインのメールアドレスを入力してください
          </p>
        </div>
      </div>

      <Button type="submit" disabled={loading || !form.name.trim()}>
        {loading ? '保存中...' : '保存'}
      </Button>
    </form>
  )
}
