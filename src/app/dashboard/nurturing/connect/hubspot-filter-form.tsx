'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const LIFECYCLE_OPTIONS = [
  { value: 'lead', label: 'リード' },
  { value: 'marketingqualifiedlead', label: 'MQL' },
  { value: 'salesqualifiedlead', label: 'SQL' },
  { value: 'opportunity', label: '商談' },
  { value: 'customer', label: '顧客' },
  { value: 'subscriber', label: '購読者' },
  { value: 'other', label: 'その他' },
]

const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: '新規' },
  { value: 'open', label: 'オープン' },
  { value: 'in_progress', label: '進行中' },
  { value: 'open_deal', label: '商談中' },
  { value: 'unqualified', label: '非適格' },
  { value: 'attempted_to_contact', label: '接触試み' },
  { value: 'connected', label: '接続済み' },
  { value: 'bad_timing', label: 'タイミング不可' },
]

type Props = {
  projectId: string
  initialFilter?: {
    lifecycles?: string[]
    leadStatuses?: string[]
  } | null
}

export default function HubSpotFilterForm({ projectId, initialFilter }: Props) {
  const router = useRouter()
  const [lifecycles, setLifecycles] = useState<string[]>(initialFilter?.lifecycles ?? [])
  const [leadStatuses, setLeadStatuses] = useState<string[]>(initialFilter?.leadStatuses ?? [])
  const [saving, setSaving] = useState(false)

  function toggleLifecycle(value: string) {
    setLifecycles((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  function toggleLeadStatus(value: string) {
    setLeadStatuses((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/nurturing/hubspot-filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, lifecycles, leadStatuses }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('フィルター設定を保存しました')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '保存に失敗しました')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">コンタクト取り込みフィルター</CardTitle>
        <CardDescription>
          チェックした条件のコンタクトのみ取り込みます。未選択の場合はすべて取り込みます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-medium">ライフサイクルステージ</Label>
          <p className="text-xs text-muted-foreground">未選択 = すべてのステージを取り込む</p>
          <div className="grid grid-cols-2 gap-2">
            {LIFECYCLE_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`lc-${opt.value}`}
                  checked={lifecycles.includes(opt.value)}
                  onCheckedChange={() => toggleLifecycle(opt.value)}
                />
                <Label htmlFor={`lc-${opt.value}`} className="text-sm font-normal cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">リードステータス</Label>
          <p className="text-xs text-muted-foreground">未選択 = すべてのステータスを取り込む</p>
          <div className="grid grid-cols-2 gap-2">
            {LEAD_STATUS_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`ls-${opt.value}`}
                  checked={leadStatuses.includes(opt.value)}
                  onCheckedChange={() => toggleLeadStatus(opt.value)}
                />
                <Label htmlFor={`ls-${opt.value}`} className="text-sm font-normal cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : 'フィルターを保存'}
        </Button>
      </CardContent>
    </Card>
  )
}
