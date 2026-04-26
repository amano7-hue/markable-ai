'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
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
}

type NavItem = { href: string; label: string; exact?: boolean; icon?: string; badge?: number }

export default function SidebarNav({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-card px-3 py-6">
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon ? ICON_MAP[item.icon] : null
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium dark:bg-primary/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {Icon && (
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : '')} />
              )}
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className={cn(
                  'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
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
    </aside>
  )
}
