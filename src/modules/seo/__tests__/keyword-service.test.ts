import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    seoKeyword: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db/client'
import {
  listKeywords,
  getKeyword,
  createKeyword,
  updateKeyword,
  deleteKeyword,
} from '../keyword-service'

const mockFindMany = prisma.seoKeyword.findMany as ReturnType<typeof vi.fn>
const mockFindFirst = prisma.seoKeyword.findFirst as ReturnType<typeof vi.fn>
const mockCreate = prisma.seoKeyword.create as ReturnType<typeof vi.fn>
const mockUpdate = prisma.seoKeyword.update as ReturnType<typeof vi.fn>
const mockDelete = prisma.seoKeyword.delete as ReturnType<typeof vi.fn>

function makeKeyword(overrides = {}) {
  return {
    id: 'kw1',
    tenantId: 't1',
    text: 'marketing automation',
    intent: null,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    snapshots: [],
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('listKeywords', () => {
  it('returns empty array when no keywords', async () => {
    mockFindMany.mockResolvedValue([])
    expect(await listKeywords('t1')).toEqual([])
  })

  it('maps keyword with no snapshots — all latest fields null', async () => {
    mockFindMany.mockResolvedValue([makeKeyword()])
    const [k] = await listKeywords('t1')
    expect(k.latestPosition).toBeNull()
    expect(k.latestClicks).toBeNull()
    expect(k.latestImpressions).toBeNull()
    expect(k.latestCtr).toBeNull()
    expect(k.lastSyncedAt).toBeNull()
  })

  it('maps keyword with snapshot — latest fields populated', async () => {
    const snapshotDate = new Date('2026-04-20')
    mockFindMany.mockResolvedValue([
      makeKeyword({
        snapshots: [{ position: 5.2, clicks: 100, impressions: 2000, ctr: 0.05, snapshotDate }],
      }),
    ])
    const [k] = await listKeywords('t1')
    expect(k.latestPosition).toBe(5.2)
    expect(k.latestClicks).toBe(100)
    expect(k.latestImpressions).toBe(2000)
    expect(k.latestCtr).toBe(0.05)
    expect(k.lastSyncedAt).toEqual(snapshotDate)
  })

  it('preserves id, text, intent, isActive, createdAt, updatedAt', async () => {
    const createdAt = new Date('2025-03-01')
    const updatedAt = new Date('2025-04-01')
    mockFindMany.mockResolvedValue([
      makeKeyword({ id: 'kw99', text: 'crm software', intent: 'commercial', isActive: false, createdAt, updatedAt }),
    ])
    const [k] = await listKeywords('t1')
    expect(k.id).toBe('kw99')
    expect(k.text).toBe('crm software')
    expect(k.intent).toBe('commercial')
    expect(k.isActive).toBe(false)
    expect(k.createdAt).toEqual(createdAt)
    expect(k.updatedAt).toEqual(updatedAt)
  })

  it('passes tenantId to prisma', async () => {
    mockFindMany.mockResolvedValue([])
    await listKeywords('specific-tenant')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'specific-tenant' } }),
    )
  })
})

describe('getKeyword', () => {
  it('returns keyword when found', async () => {
    const kw = makeKeyword()
    mockFindFirst.mockResolvedValue(kw)
    const result = await getKeyword('t1', 'kw1')
    expect(result).toEqual(kw)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'kw1', tenantId: 't1' },
    })
  })

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(null)
    expect(await getKeyword('t1', 'missing')).toBeNull()
  })
})

describe('createKeyword', () => {
  it('creates keyword with tenantId', async () => {
    const created = makeKeyword()
    mockCreate.mockResolvedValue(created)
    const result = await createKeyword('t1', { text: 'marketing automation' })
    expect(result).toEqual(created)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { text: 'marketing automation', tenantId: 't1' },
    })
  })
})

describe('updateKeyword', () => {
  it('updates keyword with correct where clause', async () => {
    const updated = makeKeyword({ isActive: false })
    mockUpdate.mockResolvedValue(updated)
    const result = await updateKeyword('t1', 'kw1', { isActive: false })
    expect(result).toEqual(updated)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'kw1', tenantId: 't1' },
      data: { isActive: false },
    })
  })
})

describe('deleteKeyword', () => {
  it('deletes keyword scoped by tenantId', async () => {
    mockDelete.mockResolvedValue(makeKeyword())
    await deleteKeyword('t1', 'kw1')
    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: 'kw1', tenantId: 't1' },
    })
  })
})
