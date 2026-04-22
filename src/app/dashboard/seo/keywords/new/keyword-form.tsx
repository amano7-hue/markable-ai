'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreateKeywordSchema, type CreateKeywordInput } from '@/modules/seo'

export default function KeywordForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateKeywordInput>({
    resolver: zodResolver(CreateKeywordSchema),
  })

  async function onSubmit(data: CreateKeywordInput) {
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/seo/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      router.push('/dashboard/seo/keywords')
      router.refresh()
    } else {
      const json = await res.json()
      setError(json.error ?? 'エラーが発生しました')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-5">
      <div className="space-y-2">
        <Label htmlFor="text">キーワード *</Label>
        <Input
          id="text"
          placeholder="例: BtoBマーケティング自動化"
          {...register('text')}
        />
        {errors.text && (
          <p className="text-xs text-destructive">{errors.text.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>検索意図（任意）</Label>
        <Select onValueChange={(v) => v && setValue('intent', v as 'informational' | 'commercial' | 'navigational')}>
          <SelectTrigger>
            <SelectValue placeholder="選択..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="informational">情報収集 (Informational)</SelectItem>
            <SelectItem value="commercial">比較検討 (Commercial)</SelectItem>
            <SelectItem value="navigational">指名検索 (Navigational)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? '追加中...' : 'キーワードを追加'}
      </Button>
    </form>
  )
}
