import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    aeoPrompt: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aeoCompetitor: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db/client'
import {
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  addCompetitor,
  removeCompetitor,
} from '../prompt-service'

const mockFindMany = prisma.aeoPrompt.findMany as ReturnType<typeof vi.fn>
const mockFindFirst = prisma.aeoPrompt.findFirst as ReturnType<typeof vi.fn>
const mockCreate = prisma.aeoPrompt.create as ReturnType<typeof vi.fn>
const mockUpdate = prisma.aeoPrompt.update as ReturnType<typeof vi.fn>
const mockDelete = prisma.aeoPrompt.delete as ReturnType<typeof vi.fn>
const mockCompetitorCreate = prisma.aeoCompetitor.create as ReturnType<typeof vi.fn>
const mockCompetitorDeleteMany = prisma.aeoCompetitor.deleteMany as ReturnType<typeof vi.fn>

function makePrompt(overrides = {}) {
  return {
    id: 'p1',
    tenantId: 't1',
    text: 'Best CRM for SMB?',
    industry: 'BtoB SaaS',
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    snapshots: [],
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

// ─── listPrompts ───────────────────────────────────────────────────────────────

describe('listPrompts', () => {
  it('returns empty array when no prompts', async () => {
    mockFindMany.mockResolvedValue([])
    expect(await listPrompts('t1')).toEqual([])
  })

  it('citationsByEngine is empty when no snapshots', async () => {
    mockFindMany.mockResolvedValue([makePrompt()])
    const [p] = await listPrompts('t1')
    expect(p.citationsByEngine).toEqual({})
    expect(p.lastSyncedAt).toBeNull()
  })

  it('picks latest snapshot per engine (first in desc order)', async () => {
    const d1 = new Date('2026-04-20')
    const d2 = new Date('2026-04-19')
    mockFindMany.mockResolvedValue([
      makePrompt({
        snapshots: [
          { engine: 'CHATGPT', ownRank: 2, snapshotDate: d1 },
          { engine: 'CHATGPT', ownRank: 3, snapshotDate: d2 }, // older, should be ignored
          { engine: 'PERPLEXITY', ownRank: null, snapshotDate: d2 },
        ],
      }),
    ])

    const [p] = await listPrompts('t1')
    expect(p.citationsByEngine.CHATGPT).toBe(2) // first occurrence (latest)
    expect(p.citationsByEngine.PERPLEXITY).toBeNull()
    expect(p.citationsByEngine.GEMINI).toBeUndefined()
  })

  it('lastSyncedAt is the most recent snapshotDate across engines', async () => {
    const older = new Date('2026-04-15')
    const newer = new Date('2026-04-20')
    mockFindMany.mockResolvedValue([
      makePrompt({
        snapshots: [
          { engine: 'CHATGPT', ownRank: 1, snapshotDate: older },
          { engine: 'PERPLEXITY', ownRank: null, snapshotDate: newer },
        ],
      }),
    ])

    const [p] = await listPrompts('t1')
    expect(p.lastSyncedAt).toEqual(newer)
  })

  it('null ownRank is preserved and not overridden by older snapshot', async () => {
    const newer = new Date('2026-04-20')
    const older = new Date('2026-04-19')
    // Most-recent snapshot has null (not cited); older has rank 1.
    // The null value should be kept — it reflects current state.
    mockFindMany.mockResolvedValue([
      makePrompt({
        snapshots: [
          { engine: 'CHATGPT', ownRank: null, snapshotDate: newer },
          { engine: 'CHATGPT', ownRank: 1, snapshotDate: older },
        ],
      }),
    ])
    const [p] = await listPrompts('t1')
    expect(p.citationsByEngine.CHATGPT).toBeNull()
  })

  it('passes tenantId to prisma query', async () => {
    mockFindMany.mockResolvedValue([])
    await listPrompts('specific-tenant')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'specific-tenant' } }),
    )
  })

  it('passes industry filter when provided', async () => {
    mockFindMany.mockResolvedValue([])
    await listPrompts('t1', 'BtoB SaaS')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', industry: 'BtoB SaaS' } }),
    )
  })

  it('omits industry filter when not provided', async () => {
    mockFindMany.mockResolvedValue([])
    await listPrompts('t1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    )
    // industry key should not be present
    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where).not.toHaveProperty('industry')
  })
})

// ─── getPrompt ─────────────────────────────────────────────────────────────────

describe('getPrompt', () => {
  it('queries with id and tenantId', async () => {
    mockFindFirst.mockResolvedValue(null)
    await getPrompt('t1', 'p99')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p99', tenantId: 't1' } }),
    )
  })

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(null)
    expect(await getPrompt('t1', 'missing')).toBeNull()
  })
})

// ─── createPrompt ──────────────────────────────────────────────────────────────

describe('createPrompt', () => {
  it('creates prompt with tenantId', async () => {
    const created = makePrompt({ competitors: [] })
    mockCreate.mockResolvedValue(created)
    const result = await createPrompt('t1', { text: 'Test prompt' })
    expect(result).toEqual(created)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 't1', text: 'Test prompt' }),
      }),
    )
  })

  it('creates competitors nested when provided', async () => {
    mockCreate.mockResolvedValue(makePrompt())
    await createPrompt('t1', { text: 'Test', competitors: ['comp.com'] })
    const call = mockCreate.mock.calls[0][0]
    expect(call.data.competitors.create).toEqual([{ tenantId: 't1', domain: 'comp.com' }])
  })
})

// ─── updatePrompt ──────────────────────────────────────────────────────────────

describe('updatePrompt', () => {
  it('updates with correct where clause', async () => {
    mockUpdate.mockResolvedValue(makePrompt({ isActive: false }))
    await updatePrompt('t1', 'p1', { isActive: false })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'p1', tenantId: 't1' },
      data: { isActive: false },
    })
  })
})

// ─── deletePrompt ──────────────────────────────────────────────────────────────

describe('deletePrompt', () => {
  it('deletes scoped by tenantId', async () => {
    mockDelete.mockResolvedValue({})
    await deletePrompt('t1', 'p1')
    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: 'p1', tenantId: 't1' },
    })
  })
})

// ─── competitor management ─────────────────────────────────────────────────────

describe('addCompetitor', () => {
  it('creates competitor with tenantId, promptId, domain', async () => {
    mockCompetitorCreate.mockResolvedValue({})
    await addCompetitor('t1', 'p1', 'comp.com')
    expect(mockCompetitorCreate).toHaveBeenCalledWith({
      data: { tenantId: 't1', promptId: 'p1', domain: 'comp.com' },
    })
  })
})

describe('removeCompetitor', () => {
  it('deletes many scoped by tenantId, promptId, domain', async () => {
    mockCompetitorDeleteMany.mockResolvedValue({ count: 1 })
    await removeCompetitor('t1', 'p1', 'comp.com')
    expect(mockCompetitorDeleteMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', promptId: 'p1', domain: 'comp.com' },
    })
  })
})
