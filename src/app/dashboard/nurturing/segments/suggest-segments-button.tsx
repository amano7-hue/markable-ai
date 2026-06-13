'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Check, Loader2 } from 'lucide-react'

const LIFECYCLE_LABELS: Record<string, string> = {
  lead: 'リード',
  marketingqualifiedlead: 'MQL',
  salesqualifiedlead: 'SQL',
  opportunity: '商談',
  customer: '顧客',
}

interface Suggestion {
  name: string
  description: string
  criteria: { lifecycle?: string[]; minIcpScore?: number }
  reason: string
}

export default function SuggestSegmentsButton({ projectId }: { projectId?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [created, setCreated] = useState<Set<number>>(new Set())

  async function handleSuggest() {
    setLoading(true)
    setSuggestions([])
    setCreated(new Set())
    setOpen(true)

    const res = await fetch('/api/nurturing/segments/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    setLoading(false)

    if (res.ok) {
      const data = await res.json()
      setSuggestions(data.data?.suggestions ?? [])
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '提案の生成に失敗しました')
      setOpen(false)
    }
  }

  async function handleCreate(idx: number, suggestion: Suggestion) {
    setCreating(idx)
    const res = await fetch('/api/nurturing/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: suggestion.name,
        description: suggestion.description,
        criteria: suggestion.criteria,
        projectId,
      }),
    })
    setCreating(null)

    if (res.ok) {
      setCreated((prev) => new Set([...prev, idx]))
      toast.success(`「${suggestion.name}」を作成しました`)
      router.refresh()
    } else {
      toast.error('作成に失敗しました')
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleSuggest}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        AI が提案
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AI セグメント提案</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">リードデータを分析中...</span>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">提案が見つかりませんでした</p>
              ) : (
                suggestions.map((s, idx) => {
                  const isCreated = created.has(idx)
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border p-4 space-y-2 transition-colors ${isCreated ? 'border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-700/40 dark:bg-emerald-950/30' : 'border-border'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={isCreated ? 'ghost' : 'outline'}
                          disabled={isCreated || creating !== null}
                          onClick={() => handleCreate(idx, s)}
                          className="shrink-0"
                        >
                          {creating === idx ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isCreated ? (
                            <><Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />作成済み</>
                          ) : (
                            '作成'
                          )}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {s.criteria.lifecycle?.map((lc) => (
                          <Badge key={lc} variant="secondary" className="text-xs">
                            {LIFECYCLE_LABELS[lc] ?? lc}
                          </Badge>
                        ))}
                        {s.criteria.minIcpScore !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            ICP ≥ {s.criteria.minIcpScore}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground italic">{s.reason}</p>
                    </div>
                  )
                })
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
