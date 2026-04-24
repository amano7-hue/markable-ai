'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; exact?: boolean; Icon?: LucideIcon }

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
              {item.Icon && (
                <item.Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : '')} />
              )}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
