'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, FolderOpen, Plus } from 'lucide-react'

type Project = {
  id: string
  name: string
  slug: string
  ownDomain: string | null
}

type Props = {
  projects: Project[]
  currentProjectId: string
  baseModule?: string // e.g. 'llmo' | 'seo'
}

export default function ProjectSwitcher({ projects, currentProjectId, baseModule }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const current = projects.find((p) => p.id === currentProjectId)

  function switchTo(projectId: string) {
    setOpen(false)
    const target = baseModule
      ? `/dashboard/p/${projectId}/${baseModule}`
      : `/dashboard/p/${projectId}/llmo`
    router.push(target)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent transition-colors"
      >
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-[120px] truncate">{current?.name ?? 'プロジェクト'}</span>
        {current?.ownDomain && (
          <span className="text-xs text-muted-foreground hidden sm:inline">({current.ownDomain})</span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-52 rounded-lg border border-border bg-card shadow-lg">
            <div className="p-1">
              <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                プロジェクト
              </p>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => switchTo(p.id)}
                  className={[
                    'flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                    p.id === currentProjectId ? 'bg-primary/5 text-primary font-medium' : '',
                  ].join(' ')}
                >
                  <span>{p.name}</span>
                  {p.ownDomain && (
                    <span className="text-xs text-muted-foreground">{p.ownDomain}</span>
                  )}
                </button>
              ))}
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => { setOpen(false); router.push('/dashboard/settings/projects') }}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                プロジェクトを追加
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
