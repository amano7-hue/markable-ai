'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const GA4_CHANNEL_GROUPS = [
  { value: 'Organic Search',   label: 'オーガニック検索',       desc: 'Google・Bing などの検索エンジン経由' },
  { value: 'Direct',           label: 'ダイレクト',             desc: 'URL直打ち・ブックマーク等' },
  { value: 'Referral',         label: 'リファラル',             desc: '外部サイトからのリンク経由' },
  { value: 'Organic Social',   label: 'オーガニックソーシャル', desc: 'SNS 自然流入（投稿リンク等）' },
  { value: 'Paid Search',      label: '有料検索',               desc: 'Google 広告など検索連動型広告' },
  { value: 'Paid Social',      label: '有料ソーシャル',         desc: 'SNS 広告経由' },
  { value: 'Email',            label: 'メール',                 desc: 'メールマガジン・メルマガ経由' },
  { value: 'Display',          label: 'ディスプレイ',           desc: 'バナー・ディスプレイ広告' },
  { value: 'Organic Video',    label: 'オーガニック動画',       desc: 'YouTube など動画プラットフォーム' },
  { value: 'Organic Shopping', label: 'オーガニックショッピング', desc: 'Google ショッピング無料枠' },
  { value: 'Unassigned',       label: '未分類',                 desc: 'チャンネルが特定できないセッション' },
]

type Props = {
  projectId: string
  initialFilter: string[]
}

export default function Ga4ChannelFilterForm({ projectId, initialFilter }: Props) {
  const [selected, setSelected] = useState<string[]>(initialFilter)
  const [loading, setLoading] = useState(false)

  function toggle(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  function selectAll() {
    setSelected(GA4_CHANNEL_GROUPS.map((g) => g.value))
  }

  function clearAll() {
    setSelected([])
  }

  async function handleSave() {
    setLoading(true)
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ga4ChannelFilter: selected }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success('チャンネルフィルターを保存しました。次回 GA4 同期時から反映されます。')
    } else {
      toast.error('保存に失敗しました')
    }
  }

  const isAllSelected = selected.length === 0
  const label = isAllSelected
    ? '全チャンネル（フィルターなし）'
    : `${selected.length} チャンネル選択中`

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
            すべて選択
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            クリア（全件）
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {GA4_CHANNEL_GROUPS.map((group) => {
          const active = selected.includes(group.value)
          return (
            <button
              key={group.value}
              type="button"
              onClick={() => toggle(group.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              {/* チェックボックス風インジケーター */}
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  active ? 'border-primary bg-primary' : 'border-input bg-background',
                )}
              >
                {active && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3 text-primary-foreground" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <div>
                <p className="text-sm font-medium leading-tight">{group.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{group.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        選択したチャンネルのセッションのみ集計対象になります。何も選択しない場合は全チャンネルを集計します。設定は次回 GA4 同期時（毎日5:00 JST）から反映されます。
      </p>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? '保存中...' : '保存'}
      </Button>
    </div>
  )
}
