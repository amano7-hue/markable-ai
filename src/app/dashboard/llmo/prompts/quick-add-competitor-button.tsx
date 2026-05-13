'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { PlusCircle, X } from 'lucide-react'

export default function QuickAddCompetitorButton({ promptId }: { promptId: string }) {
  const [open, setOpen] = useState(false)
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = domain.trim()
    if (!trimmed) return

    setLoading(true)
    const res = await fetch(`/api/llmo/prompts/${promptId}/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: trimmed }),
    })
    setLoading(false)

    if (res.ok || res.status === 409) {
      toast.success(`${trimmed} を競合に登録しました`)
      setDomain('')
      setOpen(false)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '登録に失敗しました')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="競合ドメインを追加"
      >
        <PlusCircle className="h-3 w-3" />
        競合
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-background p-3 shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium">競合ドメインを追加</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-1.5">
            <input
              ref={inputRef}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="competitor.com"
              className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={loading || !domain.trim()}
              className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? '...' : '追加'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
