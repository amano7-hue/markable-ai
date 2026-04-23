import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    tenant: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/db/client'
import { createTenantWithOwner } from '../index'

const mockFindMany = prisma.tenant.findMany as ReturnType<typeof vi.fn>
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('createTenantWithOwner', () => {
  it('creates tenant with slug derived from name', async () => {
    mockFindMany.mockResolvedValue([])
    mockTransaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => {
      const mockTx = {
        tenant: { create: vi.fn().mockResolvedValue({ id: 't1', name: 'Acme Corp', slug: 'acme-corp' }) },
        user: { create: vi.fn().mockResolvedValue({ id: 'u1' }) },
      }
      return fn(mockTx as unknown as typeof prisma)
    })

    const result = await createTenantWithOwner({
      name: 'Acme Corp',
      clerkId: 'clerk1',
      email: 'user@acme.com',
    })

    expect(result.tenant.slug).toBe('acme-corp')
  })

  it('appends numeric suffix when slug is taken', async () => {
    mockFindMany.mockResolvedValue([{ slug: 'acme' }])
    mockTransaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => {
      const mockTx = {
        tenant: { create: vi.fn().mockImplementation(({ data }: { data: { slug: string } }) =>
          Promise.resolve({ id: 't1', name: 'Acme', slug: data.slug }),
        ) },
        user: { create: vi.fn().mockResolvedValue({ id: 'u1' }) },
      }
      return fn(mockTx as unknown as typeof prisma)
    })

    const result = await createTenantWithOwner({
      name: 'Acme',
      clerkId: 'clerk1',
      email: 'user@acme.com',
    })

    expect(result.tenant.slug).toBe('acme-2')
  })

  it('passes clerkId and email to user create', async () => {
    mockFindMany.mockResolvedValue([])
    const mockUserCreate = vi.fn().mockResolvedValue({ id: 'u1' })
    mockTransaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => {
      const mockTx = {
        tenant: { create: vi.fn().mockResolvedValue({ id: 't1' }) },
        user: { create: mockUserCreate },
      }
      return fn(mockTx as unknown as typeof prisma)
    })

    await createTenantWithOwner({
      name: 'Acme',
      clerkId: 'specific-clerk-id',
      email: 'test@example.com',
      userName: 'Test User',
    })

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'specific-clerk-id',
          email: 'test@example.com',
          name: 'Test User',
          role: 'OWNER',
        }),
      }),
    )
  })

  it('sets role to OWNER for the created user', async () => {
    mockFindMany.mockResolvedValue([])
    const mockUserCreate = vi.fn().mockResolvedValue({ id: 'u1' })
    mockTransaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => {
      const mockTx = {
        tenant: { create: vi.fn().mockResolvedValue({ id: 't1' }) },
        user: { create: mockUserCreate },
      }
      return fn(mockTx as unknown as typeof prisma)
    })

    await createTenantWithOwner({ name: 'Acme', clerkId: 'c1', email: 'a@a.com' })

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'OWNER' }) }),
    )
  })
})
