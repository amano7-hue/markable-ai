'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  AlertCircle,
  Lightbulb,
  Hash,
  FileText,
  Link2,
  Users,
  Layers,
  Mail,
  Settings,
  BarChart2,
  GitMerge,
  TrendingUp,
  ShieldAlert,
  Search,
  Palette,
  BookOpen,
  Menu,
  X,
  Clock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageSquare,
  AlertCircle,
  Lightbulb,
  Hash,
  FileText,
  Link2,
  Users,
  Layers,
  Mail,
  Settings,
  BarChart2,
  GitMerge,
  TrendingUp,
  ShieldAlert,
  Search,
  Palette,
  BookOpen,
  Clock,
}

type NavItem = { href: string; label: string; exact?: boolean; icon?: string; badge?: number }

function NavList({ items, onItemClick }: { items: NavItem[]; onItemClick?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-px">
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon ? ICON_MAP[item.icon] : null
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              'flex items-center gap-2 rounded px-2.5 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary/10 text-primary font-medium dark:bg-primary/20'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {Icon && (
              <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-primary' : '')} />
            )}
            <span className="flex-1 leading-none">{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span className={cn(
                'ml-auto flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-semibold tabular-nums',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-amber-500 text-white',
              )}>
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

export default function SidebarNav({ title, items }: { title: string; items: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // ページ遷移時に閉じる
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      {/* デスクトップサイドバー */}
      <aside className="hidden md:flex w-48 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {title}
          </p>
          <NavList items={items} />
        </div>
      </aside>

      {/* モバイル: ハンバーガーボタン */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-5 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-lg"
        aria-label="メニューを開く"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* モバイル: オーバーレイドロワー */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="md:hidden fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {title}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-3 py-3">
              <NavList items={items} onItemClick={() => setOpen(false)} />
            </div>
          </div>
        </>
      )}
    </>
  )
}
