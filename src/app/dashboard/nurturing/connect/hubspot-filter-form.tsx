'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlusCircle, Trash2 } from 'lucide-react'
import type { HubSpotProperty } from '@/integrations/hubspot'

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

const OPERATOR_OPTIONS = [
  { value: 'eq', label: '等しい' },
  { value: 'neq', label: '等しくない' },
  { value: 'contains', label: '含む' },
  { value: 'in', label: 'いずれかに一致（カンマ区切り）' },
  { value: 'not_empty', label: '空でない' },
]

type CustomCondition = {
  objectType: 'contact' | 'deal'
  field: string
  operator: 'eq' | 'neq' | 'contains' | 'in' | 'not_empty'
  value?: string
}

type Props = {
  projectId: string
  initialFilter?: {
    lifecycles?: string[]
    leadStatuses?: string[]
    customConditions?: CustomCondition[]
  } | null
}

export default function HubSpotFilterForm({ projectId, initialFilter }: Props) {
  const router = useRouter()
  const [lifecycles, setLifecycles] = useState<string[]>(initialFilter?.lifecycles ?? [])
  const [leadStatuses, setLeadStatuses] = useState<string[]>(initialFilter?.leadStatuses ?? [])
  const [customConditions, setCustomConditions] = useState<CustomCondition[]>(
    (initialFilter?.customConditions ?? []).map((c) => ({
      ...c,
      value: Array.isArray(c.value) ? c.value.join(',') : (c.value ?? ''),
    })) as CustomCondition[]
  )
  const [saving, setSaving] = useState(false)
  const [contactProps, setContactProps] = useState<HubSpotProperty[]>([])
  const [dealProps, setDealProps] = useState<HubSpotProperty[]>([])
  const [loadingProps, setLoadingProps] = useState(false)

  useEffect(() => {
    setLoadingProps(true)
    fetch(`/api/nurturing/hubspot-fields?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          setContactProps(data.data.contacts ?? [])
          setDealProps(data.data.deals ?? [])
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProps(false))
  }, [projectId])

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

  function addCondition() {
    setCustomConditions((prev) => [
      ...prev,
      { objectType: 'contact', field: '', operator: 'eq', value: '' },
    ])
  }

  function updateCondition(idx: number, patch: Partial<CustomCondition>) {
    setCustomConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  function removeCondition(idx: number) {
    setCustomConditions((prev) => prev.filter((_, i) => i !== idx))
  }

  function getPropsForType(objectType: 'contact' | 'deal') {
    return objectType === 'contact' ? contactProps : dealProps
  }

  async function handleSave() {
    setSaving(true)
    // value が 'in' 演算子の場合はカンマ区切りを配列に変換
    const conditions = customConditions
      .filter((c) => c.field)
      .map((c) => ({
        ...c,
        value: c.operator === 'in'
          ? c.value?.split(',').map((v) => v.trim()).filter(Boolean)
          : c.operator === 'not_empty'
          ? undefined
          : c.value || undefined,
      }))

    const res = await fetch('/api/nurturing/hubspot-filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, lifecycles, leadStatuses, customConditions: conditions }),
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
      <CardContent className="space-y-6">
        {/* ライフサイクル */}
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

        {/* リードステータス */}
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

        {/* カスタム条件 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">カスタム条件</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                コンタクトや取引のプロパティで絞り込みます
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCondition}
              disabled={loadingProps}
              className="gap-1.5"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              条件を追加
            </Button>
          </div>

          {customConditions.length === 0 && (
            <p className="text-xs text-muted-foreground/60 italic">カスタム条件なし</p>
          )}

          {customConditions.map((cond, idx) => {
            const props = getPropsForType(cond.objectType)
            const selectedProp = props.find((p) => p.name === cond.field)
            return (
              <div key={idx} className="flex flex-col gap-2 rounded-md border border-border p-3 bg-muted/20">
                <div className="flex gap-2">
                  {/* オブジェクトタイプ */}
                  <Select
                    value={cond.objectType}
                    onValueChange={(v) => updateCondition(idx, { objectType: v as 'contact' | 'deal', field: '', value: '' })}
                  >
                    <SelectTrigger className="w-28 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact">コンタクト</SelectItem>
                      <SelectItem value="deal">取引</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* フィールド */}
                  <Select
                    value={cond.field}
                    onValueChange={(v) => updateCondition(idx, { field: v ?? '', value: '' })}
                  >
                    <SelectTrigger className="flex-1 text-xs h-8">
                      <SelectValue placeholder={loadingProps ? '読み込み中...' : 'フィールドを選択'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {props.map((p) => (
                        <SelectItem key={p.name} value={p.name} className="text-xs">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => removeCondition(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>

                {cond.field && (
                  <div className="flex gap-2">
                    {/* 演算子 */}
                    <Select
                      value={cond.operator}
                      onValueChange={(v) => updateCondition(idx, { operator: v as CustomCondition['operator'] })}
                    >
                      <SelectTrigger className="w-48 text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATOR_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* 値入力 */}
                    {cond.operator !== 'not_empty' && (
                      selectedProp?.options?.length ? (
                        <Select
                          value={cond.value ?? undefined}
                          onValueChange={(v) => updateCondition(idx, { value: v ?? undefined })}
                        >
                          <SelectTrigger className="flex-1 text-xs h-8">
                            <SelectValue placeholder="値を選択" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {(selectedProp.options ?? []).map((o: { label: string; value: string }) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="flex-1 h-8 text-xs"
                          placeholder={cond.operator === 'in' ? '値1, 値2, 値3' : '値を入力'}
                          value={cond.value ?? ''}
                          onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : 'フィルターを保存'}
        </Button>
      </CardContent>
    </Card>
  )
}
