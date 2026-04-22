import { prisma } from '@/lib/db/client'

/**
 * slug から一意になるよう数字サフィックスを付与する。
 * 例: "acme" → "acme" / "acme-2" / "acme-3" ...
 */
async function uniqueSlug(base: string): Promise<string> {
  const existing = await prisma.tenant.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  })
  if (existing.length === 0) return base
  const slugs = new Set(existing.map((t) => t.slug))
  let i = 2
  while (slugs.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

type CreateTenantInput = {
  name: string
  clerkId: string
  email: string
  userName?: string
}

/**
 * 新規テナントとオーナーユーザーをトランザクションで作成する。
 */
export async function createTenantWithOwner({
  name,
  clerkId,
  email,
  userName,
}: CreateTenantInput) {
  const slug = await uniqueSlug(toSlug(name))

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name, slug } })
    const user = await tx.user.create({
      data: {
        clerkId,
        email,
        name: userName,
        role: 'OWNER',
        tenantId: tenant.id,
      },
    })
    return { tenant, user }
  })
}
