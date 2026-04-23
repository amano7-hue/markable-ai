import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'ホーム', exact: true },
  { href: '/dashboard/aeo', label: 'AEO' },
  { href: '/dashboard/seo', label: 'SEO' },
  { href: '/dashboard/nurturing', label: 'ナーチャリング' },
  { href: '/dashboard/analytics', label: 'アナリティクス' },
  { href: '/dashboard/attribution', label: 'アトリビューション' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const pendingCount = await prisma.approvalItem.count({
    where: { tenantId: ctx.tenant.id, status: 'PENDING' },
  })

  return (
    <div className="min-h-screen bg-background">
      {/* グローバルヘッダー */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-12 items-center gap-1 px-4">
          <Link
            href="/dashboard"
            className="mr-4 text-sm font-semibold tracking-tight"
          >
            Markeble AI
          </Link>

          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard/approval?status=PENDING"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-sm hover:bg-accent transition-colors"
            >
              承認キュー
              {pendingCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                  {pendingCount}
                </span>
              )}
            </Link>
            <span className="text-xs text-muted-foreground">{ctx.tenant.name}</span>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
