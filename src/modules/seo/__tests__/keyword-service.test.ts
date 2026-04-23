import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    seoKeyword: {
      findMany: vi.fn(),
      count: vi.fn(),
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
const mockCount = prisma.seoKeyword.count as ReturnType<typeof vi.fn>
const mockFindFirst = prisma.seoKeyword.findFirst as ReturnType<typeof vi.fn>
const mockCreate = prisma.seoKeyword.create as ReturnType<typeof vi.fn>
const mockUpdate = prisma.seoKeyword.update as ReturnType<typeof vi.fn>
const mockDelete = prisma.seoKeyword.delete as ReturnType<typeof vi.fn>

function makeRaw(overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  vi.clearAllMocks()
  mockCount.mockResolvedValue(0)
})

describe('listKeywords — shape', () => {
  it('returns { keywords, total } shape', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
    const result = await listKeywords('t1')
    expect(result).toHaveProperty('keywords')
    expect(result).toHaveProperty('total')
    expect(result.keywords).toEqual([])
    expect(result.total).toBe(0)
  })

  it('maps keyword with no snapshots — all latest fields null', async () => {
    mockFindMany.mockResolvedValue([makeRaw()])
    mockCount.mockResolvedValue(1)
    const { keywords } = await listKeywords('t1')
    expect(keywords[0].latestPosition).toBeNull()
    expect(keywords[0].latestClicks).toBeNull()
    expect(keywords[0].latestImpressions).toBeNull()
    expect(keywords[0].latestCtr).toBeNull()
    expect(keywords[0].lastSyncedAt).toBeNull()
  })

  it('maps keyword with snapshot — latest fields populated', async () => {
    const snapshotDate = new Date('2026-04-20')
    mockFindMany.mockResolvedValue([
      makeRaw({
        snapshots: [{ position: 5.2, clicks: 100, impressions: 2000, ctr: 0.05, snapshotDate }],
      }),
    ])
    mockCount.mockResolvedValue(1)
    const { keywords } = await listKeywords('t1')
    expect(keywords[0].latestPosition).toBe(5.2)
    expect(keywords[0].latestClicks).toBe(100)
    expect(keywords[0].latestImpressions).toBe(2000)
    expect(keywords[0].latestCtr).toBe(0.05)
    expect(keywords[0].lastSyncedAt).toEqual(snapshotDate)
  })

  it('preserves id, text, intent, isActive, createdAt, updatedAt', async () => {
    const createdAt = new Date('2025-03-01')
    const updatedAt = new Date('2025-04-01')
    mockFindMany.mockResolvedValue([
      makeRaw({ id: 'kw99', text: 'crm software', intent: 'commercial', isActive: false, createdAt, updatedAt }),
    ])
    mockCount.mockResolvedValue(1)
    const { keywords } = await listKeywords('t1')
    const k = keywords[0]
    expect(k.id).toBe('kw99')
    expect(k.text).toBe('crm software')
    expect(k.intent).toBe('commercial')
    expect(k.isActive).toBe(false)
    expect(k.createdAt).toEqual(createdAt)
    expect(k.updatedAt).toEqual(updatedAt)
  })

  it('passes tenantId to prisma', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
    await listKeywords('specific-tenant')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'specific-tenant' } }),
    )
  })

  it('total reflects count query result', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(42)
    const { total } = await listKeywords('t1')
    expect(total).toBe(42)
  })
})

describe('listKeywords — sort', () => {
  const d1 = new Date('2025-01-01')
  const d2 = new Date('2025-06-01')
  const d3 = new Date('2025-12-01')

  function makeKwWithPos(id: string, pos: number | null, created: Date, impressions: number) {
    return makeRaw({
      id,
      createdAt: created,
      snapshots: pos !== null
        ? [{ position: pos, clicks: 0, impressions, ctr: 0, snapshotDate: new Date() }]
        : [],
    })
  }

  it('sort=position: ascending (best rank first), null positions last', async () => {
    mockFindMany.mockResolvedValue([
      makeKwWithPos('kw-null', null, d1, 0),
      makeKwWithPos('kw-30', 30, d2, 0),
      makeKwWithPos('kw-3', 3, d3, 0),
    ])
    mockCount.mockResolvedValue(3)
    const { keywords } = await listKeywords('t1', { sort: 'position' })
    expect(keywords.map((k) => k.id)).toEqual(['kw-3', 'kw-30', 'kw-null'])
  })

  it('sort=impressions: descending (most impressions first)', async () => {
    mockFindMany.mockResolvedValue([
      makeKwWithPos('kw-100', 5, d1, 100),
      makeKwWithPos('kw-500', 10, d2, 500),
      makeKwWithPos('kw-0', null, d3, 0),
    ])
    mockCount.mockResolvedValue(3)
    const { keywords } = await listKeywords('t1', { sort: 'impressions' })
    expect(keywords.map((k) => k.id)).toEqual(['kw-500', 'kw-100', 'kw-0'])
  })

  it('sort=created (default): newest first', async () => {
    mockFindMany.mockResolvedValue([
      makeKwWithPos('kw-old', null, d1, 0),
      makeKwWithPos('kw-new', null, d3, 0),
      makeKwWithPos('kw-mid', null, d2, 0),
    ])
    mockCount.mockResolvedValue(3)
    const { keywords } = await listKeywords('t1', { sort: 'created' })
    expect(keywords.map((k) => k.id)).toEqual(['kw-new', 'kw-mid', 'kw-old'])
  })

  it('default sort is "created" (newest first)', async () => {
    mockFindMany.mockResolvedValue([
      makeKwWithPos('old', null, d1, 0),
      makeKwWithPos('new', null, d3, 0),
    ])
    mockCount.mockResolvedValue(2)
    const { keywords } = await listKeywords('t1')
    expect(keywords[0].id).toBe('new')
  })
})

describe('listKeywords — pagination', () => {
  it('page=2 returns second 50 items', async () => {
    // Simulate 60 keywords (all same date so stable sort)
    const all = Array.from({ length: 60 }, (_, i) =>
      makeRaw({ id: `kw-${i}`, createdAt: new Date(2025, 0, i + 1) })
    )
    // Sorted newest first: kw-59 … kw-0
    mockFindMany.mockResolvedValue(all)
    mockCount.mockResolvedValue(60)
    const { keywords } = await listKeywords('t1', { page: 2 })
    expect(keywords).toHaveLength(10) // 60 - 50 = 10 on page 2
  })

  it('page=1 returns first 50 items', async () => {
    const all = Array.from({ length: 60 }, (_, i) => makeRaw({ id: `kw-${i}` }))
    mockFindMany.mockResolvedValue(all)
    mockCount.mockResolvedValue(60)
    const { keywords } = await listKeywords('t1', { page: 1 })
    expect(keywords).toHaveLength(50)
  })
})

describe('getKeyword', () => {
  it('returns keyword when found', async () => {
    const kw = makeRaw()
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
    const created = makeRaw()
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
    const updated = makeRaw({ isActive: false })
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
    mockDelete.mockResolvedValue(makeRaw())
    await deleteKeyword('t1', 'kw1')
    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: 'kw1', tenantId: 't1' },
    })
  })
})
