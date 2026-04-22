import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

const NAV_ITEMS = [
  { href: '/dashboard/seo', label: 'サマリー' },
  { href: '/dashboard/seo/keywords', label: 'キーワード' },
  { href: '/dashboard/seo/opportunities', label: '改善機会' },
  { href: '/dashboard/seo/articles', label: '記事ドラフト' },
  { href: '/dashboard/seo/connect', label: 'GSC 設定' },
]

export default async function SeoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r border-border bg-card px-4 py-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          SEO
        </p>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  )
}
