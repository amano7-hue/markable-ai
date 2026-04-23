'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Props = {
  href: string
  exact?: boolean
  className?: string
  activeClassName?: string
  children: React.ReactNode
}

export default function ActiveLink({
  href,
  exact = false,
  className,
  activeClassName,
  children,
}: Props) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(className, isActive && activeClassName)}
    >
      {children}
    </Link>
  )
}
