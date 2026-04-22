'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreatePromptSchema, type CreatePromptInput } from '@/modules/aeo'
import type { AeoTemplate } from '@/modules/aeo'

export default function PromptForm() {
  const router = useRouter()
  const [templates, setTemplates] = useState<AeoTemplate[]>([])
  const [competitors, setCompetitors] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreatePromptInput>({
    resolver: zodResolver(CreatePromptSchema),
  })

  useEffect(() => {
    fetch('/api/aeo/templates')
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {})
  }, [])

  function applyTemplate(text: string | null) {
    if (text) setValue('text', text)
  }

  async function onSubmit(data: CreatePromptInput) {
    setSubmitting(true)
    setError(null)

    const validCompetitors = competitors.filter((c) => c.trim())
    const res = await fetch('/api/aeo/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, competitors: validCompetitors }),
    })

    if (res.ok) {
      router.push('/dashboard/aeo/prompts')
      router.refresh()
    } else {
      const json = await res.json()
      setError(json.error ?? 'エラーが発生しました')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-6">
      {templates.length > 0 && (
        <div className="space-y-2">
          <Label>テンプレートから選ぶ（任意）</Label>
          <Select onValueChange={applyTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="テンプレートを選択..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.text}>
                  [{t.industry}] {t.text.slice(0, 40)}...
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="text">プロンプト文 *</Label>
        <Textarea
          id="text"
          rows={3}
          placeholder="例: BtoBマーケティングツールのおすすめを教えてください"
          {...register('text')}
        />
        {errors.text && (
          <p className="text-xs text-destructive">{errors.text.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry">業界（任意）</Label>
        <Input
          id="industry"
          placeholder="例: BtoB SaaS"
          {...register('industry')}
        />
      </div>

      <div className="space-y-2">
        <Label>競合ドメイン（最大10件）</Label>
        {competitors.map((domain, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              value={domain}
              onChange={(e) => {
                const next = [...competitors]
                next[idx] = e.target.value
                setCompetitors(next)
              }}
              placeholder="例: hubspot.com"
            />
            {competitors.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCompetitors(competitors.filter((_, i) => i !== idx))
                }
              >
                削除
              </Button>
            )}
          </div>
        ))}
        {competitors.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCompetitors([...competitors, ''])}
          >
            + 競合を追加
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? '作成中...' : 'プロンプトを作成'}
      </Button>
    </form>
  )
}
