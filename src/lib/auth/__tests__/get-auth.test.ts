import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/client'
import { getAuth, requireAuth } from '../get-auth'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>

const mockUser = {
  id: 'u1',
  clerkId: 'clerk1',
  email: 'user@example.com',
  name: null,
  role: 'OWNER',
  tenantId: 't1',
  createdAt: new Date(),
  updatedAt: new Date(),
  tenant: {
    id: 't1',
    name: 'Acme',
    slug: 'acme',
    ownDomain: null,
    serankingProjectId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}

beforeEach(() => vi.clearAllMocks())

describe('getAuth', () => {
  it('returns null when no userId from clerk', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const result = await getAuth()
    expect(result).toBeNull()
  })

  it('returns null when user not found in DB', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    mockUserFindUnique.mockResolvedValue(null)
    const result = await getAuth()
    expect(result).toBeNull()
  })

  it('returns AuthContext when user exists', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    mockUserFindUnique.mockResolvedValue(mockUser)

    const result = await getAuth()
    expect(result).not.toBeNull()
    expect(result!.clerkId).toBe('clerk1')
    expect(result!.user.id).toBe('u1')
    expect(result!.tenant.id).toBe('t1')
  })

  it('queries user by clerkId', async () => {
    mockAuth.mockResolvedValue({ userId: 'specific-clerk-id' })
    mockUserFindUnique.mockResolvedValue(mockUser)

    await getAuth()
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkId: 'specific-clerk-id' } }),
    )
  })

  it('includes tenant in user query', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    mockUserFindUnique.mockResolvedValue(mockUser)

    await getAuth()
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ include: { tenant: true } }),
    )
  })

  it('does not query DB when userId is null', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    await getAuth()
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })
})

describe('requireAuth', () => {
  it('returns AuthContext when authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    mockUserFindUnique.mockResolvedValue(mockUser)

    const result = await requireAuth()
    expect(result.clerkId).toBe('clerk1')
  })

  it('throws when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    await expect(requireAuth()).rejects.toThrow('Unauthorized')
  })

  it('throws when user not in DB', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk1' })
    mockUserFindUnique.mockResolvedValue(null)
    await expect(requireAuth()).rejects.toThrow('Unauthorized')
  })
})
