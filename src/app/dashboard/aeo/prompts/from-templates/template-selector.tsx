'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AeoTemplate } from '@/modules/aeo'

interface Props {
  templates: AeoTemplate[]
}

export default function TemplateSelector({ templates }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAll() {
    if (selected.size === templates.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(templates.map((t) => t.id)))
    }
  }

  // テンプレートを業界別にグループ化
  const groups = templates.reduce<Record<string, AeoTemplate[]>>((acc, t) => {
    const key = t.industry
    acc[key] = acc[key] ? [...acc[key], t] : [t]
    return acc
  }, {})

  async function handleCreate() {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/aeo/prompts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateIds: Array.from(selected) }),
      })
      const data = (await res.json()) as { created?: number; skipped?: number }
      if (res.ok) {
        const msg =
          data.skipped && data.skipped > 0
            ? `${data.created} 件を作成しました（${data.skipped} 件は重複のためスキップ）`
            : `${data.created} 件のプロンプトを作成しました`
        toast.success(msg)
        router.push('/dashboard/aeo/prompts')
        router.refresh()
      } else {
        toast.error('作成に失敗しました')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー操作 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {selected.size === templates.length ? 'すべて解除' : 'すべて選択'}
        </button>
        <Button
          onClick={handleCreate}
          disabled={selected.size === 0 || submitting}
          size="sm"
        >
          {submitting
            ? '作成中...'
            : selected.size > 0
              ? `${selected.size} 件を追加`
              : '選択してください'}
        </Button>
      </div>

      {/* 業界グループ */}
      {Object.entries(groups).map(([industry, items]) => (
        <div key={industry}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{industry}</h3>
          <div className="space-y-2">
            {items.map((t) => {
              const isChecked = selected.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    isChecked
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <span
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 ${
                      isChecked ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    }`}
                    aria-hidden
                  />
                  <span className="flex-1">{t.text}</span>
                  {isChecked && (
                    <Badge className="shrink-0 text-xs" variant="secondary">
                      選択中
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
