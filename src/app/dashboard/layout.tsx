import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import ActiveLink from '@/components/active-link'

const NAV_ITEMS: { href: string; label: string; exact?: boolean; module?: string }[] = [
  { href: '/dashboard', label: 'ホーム', exact: true },
  { href: '/dashboard/aeo', label: 'AEO', module: 'aeo' },
  { href: '/dashboard/seo', label: 'SEO', module: 'seo' },
  { href: '/dashboard/nurturing', label: 'ナーチャリング', module: 'nurturing' },
  { href: '/dashboard/analytics', label: 'アナリティクス' },
  { href: '/dashboard/attribution', label: 'アトリビューション' },
  { href: '/dashboard/settings', label: '設定' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const [pendingCount, pendingByModule, aeoHealth, seoHealth, nurtureHealth] = await Promise.all([
    prisma.approvalItem.count({
      where: { tenantId: ctx.tenant.id, status: 'PENDING' },
    }),
    prisma.approvalItem.groupBy({
      by: ['module'],
      where: { tenantId: ctx.tenant.id, status: 'PENDING' },
      _count: true,
    }),
    // AEO health: cited / total active prompts
    Promise.all([
      prisma.aeoRankSnapshot.groupBy({
        by: ['promptId'],
        where: { tenantId: ctx.tenant.id, ownRank: { not: null } },
      }).then((r) => r.length),
      prisma.aeoPrompt.count({ where: { tenantId: ctx.tenant.id, isActive: true } }),
    ]).then(([cited, total]) => {
      if (total === 0) return 'warn' as const
      const rate = cited / total
      return rate >= 0.5 ? 'good' as const : rate >= 0.2 ? 'warn' as const : 'bad' as const
    }),
    // SEO health: has active keywords + not too many stale pending articles
    Promise.all([
      prisma.seoKeyword.count({ where: { tenantId: ctx.tenant.id, isActive: true } }),
      prisma.seoArticle.count({ where: { tenantId: ctx.tenant.id, status: 'PENDING' } }),
    ]).then(([kwCount, pending]) =>
      kwCount === 0 ? 'warn' as const : pending > 10 ? 'warn' as const : 'good' as const
    ),
    // Nurturing health: has leads + has segments
    Promise.all([
      prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id } }),
      prisma.nurtureSegment.count({ where: { tenantId: ctx.tenant.id } }),
    ]).then(([leads, segs]) =>
      leads === 0 ? 'bad' as const : segs === 0 ? 'warn' as const : 'good' as const
    ),
  ])

  const pendingMap = Object.fromEntries(pendingByModule.map((r) => [r.module, r._count]))

  const moduleHealth: Record<string, 'good' | 'warn' | 'bad'> = {
    aeo: aeoHealth,
    seo: seoHealth,
    nurturing: nurtureHealth,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* グローバルヘッダー */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-12 items-center gap-1 px-4">
          <Link
            href="/dashboard"
            className="mr-4 flex items-center gap-2 shrink-0"
          >
            <Image
              src="/logo-mark.svg"
              alt="Markable AI"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-sm font-semibold tracking-tight">
              Markable <span className="text-[#0E5EC0]">AI</span>
            </span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const badge = item.module ? (pendingMap[item.module] ?? 0) : 0
              const health = item.module ? moduleHealth[item.module] : undefined
              const healthDotColor =
                health === 'good' ? 'bg-emerald-500' :
                health === 'warn' ? 'bg-amber-500' :
                health === 'bad' ? 'bg-destructive' : undefined
              return (
                <ActiveLink
                  key={item.href}
                  href={item.href}
                  exact={item.exact}
                  className="relative rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  activeClassName="bg-primary/10 text-primary font-medium dark:bg-primary/20"
                >
                  <span className="flex items-center gap-1.5">
                    {healthDotColor && (
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${healthDotColor}`} />
                    )}
                    {item.label}
                  </span>
                  {badge > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {badge}
                    </span>
                  )}
                </ActiveLink>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ActiveLink
              href="/dashboard/approval"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-sm hover:bg-accent transition-colors"
              activeClassName="bg-primary/10 text-primary border-primary/30 dark:bg-primary/20"
            >
              承認キュー
              {pendingCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-medium text-white">
                  {pendingCount}
                </span>
              )}
            </ActiveLink>
            <span className="text-xs text-muted-foreground">{ctx.tenant.name}</span>
            <UserButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
