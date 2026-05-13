'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Menu, X, ChevronDown, FolderOpen, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  exact?: boolean
  module?: string        // project-scoped module name (e.g. 'seo', 'llmo')
  badge?: number
  health?: 'good' | 'warn' | 'bad'
}

type Project = {
  id: string
  name: string
  slug: string
  ownDomain: string | null
  isDefault: boolean
}

type Props = {
  navItems: NavItem[]
  pendingCount: number
  projects: Project[]
  currentProjectId: string  // default project id (fallback)
}

function ActiveLink({
  href,
  exact,
  className,
  activeClassName,
  children,
  onClick,
}: {
  href: string
  exact?: boolean
  className?: string
  activeClassName?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  return (
    <Link href={href} onClick={onClick} className={cn(className, isActive && activeClassName)}>
      {children}
    </Link>
  )
}

function ProjectSwitcherInline({
  projects,
  currentProjectId,
}: {
  projects: Project[]
  currentProjectId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const current = projects.find((p) => p.id === currentProjectId)

  // 現在のモジュールを推測してプロジェクト切り替え先URLを決定
  function switchTo(projectId: string) {
    setOpen(false)
    const match = pathname.match(/\/dashboard\/p\/[^/]+\/([^/]+)/)
    const module = match?.[1] ?? 'llmo'
    router.push(`/dashboard/p/${projectId}/${module}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
      >
        <FolderOpen className="h-3 w-3" />
        <span className="max-w-[100px] truncate">{current?.name ?? 'プロジェクト'}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded border border-border bg-card shadow-lg">
            <div className="p-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => switchTo(p.id)}
                  className={cn(
                    'flex w-full flex-col rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent',
                    p.id === currentProjectId ? 'bg-primary/5 text-primary font-medium' : '',
                  )}
                >
                  <span>{p.name}</span>
                  {p.ownDomain && (
                    <span className="text-[10px] text-muted-foreground">{p.ownDomain}</span>
                  )}
                </button>
              ))}
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => { setOpen(false); router.push('/dashboard/settings/projects') }}
                className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                <Plus className="h-3 w-3" />
                プロジェクトを追加
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardHeader({ navItems, pendingCount, projects, currentProjectId }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null)
  const pathname = usePathname()

  // URLからprojectIdを検出。あれば localStorage に保存して維持する
  const urlProjectId = pathname.match(/\/dashboard\/p\/([^/]+)/)?.[1] ?? null

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (urlProjectId) {
      localStorage.setItem('markable_active_project', urlProjectId)
      setStoredProjectId(urlProjectId)
    } else {
      const saved = localStorage.getItem('markable_active_project')
      setStoredProjectId(saved)
    }
  }, [urlProjectId])

  // URLにあればそれを優先、なければlocalStorage、最後にデフォルト
  const activeProjectId = urlProjectId ?? storedProjectId ?? currentProjectId

  // href内のデフォルトprojectIdを現在のprojectIdに置換（プロジェクトスコープのリンクのみ）
  const resolvedNavItems = navItems.map((item) => {
    if (!currentProjectId || !item.href.includes(`/dashboard/p/${currentProjectId}/`)) return item
    return { ...item, href: item.href.replace(`/dashboard/p/${currentProjectId}/`, `/dashboard/p/${activeProjectId}/`) }
  })

  const healthDotColor = (health?: 'good' | 'warn' | 'bad') =>
    health === 'good' ? 'bg-emerald-500' :
    health === 'warn' ? 'bg-amber-500' :
    health === 'bad' ? 'bg-destructive' : undefined

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-12 items-center gap-1 px-3 md:px-4">
          {/* ロゴ */}
          <Link href="/dashboard" className="mr-2 flex items-center gap-1.5 shrink-0">
            <Image src="/logo-mark.svg" alt="Markable AI" width={22} height={22} className="h-5.5 w-5.5" />
            <span className="text-sm font-semibold tracking-tight">
              Markable <span className="text-[#0E5EC0]">AI</span>
            </span>
          </Link>

          {/* デスクトップナビ */}
          <nav className="hidden md:flex items-center gap-px">
            {resolvedNavItems.map((item) => {
              const dot = healthDotColor(item.health)
              return (
                <ActiveLink
                  key={item.href}
                  href={item.href}
                  exact={item.exact}
                  className="relative rounded px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  activeClassName="bg-primary/10 text-primary font-medium dark:bg-primary/20"
                >
                  <span className="flex items-center gap-1">
                    {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />}
                    {item.label}
                  </span>
                  {(item.badge ?? 0) > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded bg-amber-500 px-0.5 text-[9px] font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </ActiveLink>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {/* 承認キュー */}
            <ActiveLink
              href="/dashboard/approval"
              className="hidden sm:inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs hover:bg-accent transition-colors"
              activeClassName="bg-primary/10 text-primary border-primary/30"
            >
              承認キュー
              {pendingCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-amber-500 px-0.5 text-[10px] font-medium text-white">
                  {pendingCount}
                </span>
              )}
            </ActiveLink>

            {/* プロジェクト切り替え */}
            {projects.length > 0 && (
              <ProjectSwitcherInline projects={projects} currentProjectId={activeProjectId} />
            )}

            <UserButton />

            {/* モバイルハンバーガー */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden ml-1 rounded p-1.5 text-muted-foreground hover:bg-accent"
              aria-label="メニュー"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* モバイルドロワー */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed right-0 top-0 z-50 flex h-full w-72 flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">メニュー</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-px">
              {resolvedNavItems.map((item) => {
                const dot = healthDotColor(item.health)
                return (
                  <ActiveLink
                    key={item.href}
                    href={item.href}
                    exact={item.exact}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <span className="flex items-center gap-2">
                      {dot && <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />}
                      {item.label}
                    </span>
                    {(item.badge ?? 0) > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded bg-amber-500 px-1 text-[10px] font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </ActiveLink>
                )
              })}
              <div className="my-2 border-t border-border" />
              <ActiveLink
                href="/dashboard/approval"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between rounded px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <span>承認キュー</span>
                {pendingCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded bg-amber-500 px-1 text-[10px] font-semibold text-white">
                    {pendingCount}
                  </span>
                )}
              </ActiveLink>
            </nav>
          </div>
        </>
      )}
    </>
  )
}
