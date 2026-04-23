import { PrismaClient } from '@/generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'
import { withTenantGuard } from './tenant-middleware'

type GuardedPrismaClient = ReturnType<typeof withTenantGuard>

const globalForPrisma = globalThis as unknown as { prisma: GuardedPrismaClient }

function createPrismaClient(): GuardedPrismaClient {
  const adapter = new PrismaNeon({ connectionString: process.env.POSTGRES_PRISMA_URL! })
  const base = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
  return withTenantGuard(base)
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
