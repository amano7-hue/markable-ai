import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    nurtureSegment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    nurtureLead: { findMany: vi.fn() },
    nurtureLeadSegment: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/db/client'
import {
  applySegmentCriteria,
  listSegments,
  getSegment,
  createSegment,
  deleteSegment,
} from '../segment-service'

const mockSegmentFindFirst = prisma.nurtureSegment.findFirst as ReturnType<typeof vi.fn>
const mockSegmentFindMany = prisma.nurtureSegment.findMany as ReturnType<typeof vi.fn>
const mockSegmentCreate = prisma.nurtureSegment.create as ReturnType<typeof vi.fn>
const mockSegmentDelete = prisma.nurtureSegment.delete as ReturnType<typeof vi.fn>
const mockLeadFindMany = prisma.nurtureLead.findMany as ReturnType<typeof vi.fn>
const mockLeadSegDeleteMany = prisma.nurtureLeadSegment.deleteMany as ReturnType<typeof vi.fn>
const mockLeadSegCreateMany = prisma.nurtureLeadSegment.createMany as ReturnType<typeof vi.fn>

function makeSegment(criteria: object = {}) {
  return { id: 'seg1', tenantId: 't1', criteria }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLeadSegDeleteMany.mockResolvedValue({ count: 0 })
  mockLeadSegCreateMany.mockResolvedValue({ count: 0 })
})

// ─── listSegments ──────────────────────────────────────────────────────────────

describe('listSegments', () => {
  it('returns empty array when no segments', async () => {
    mockSegmentFindMany.mockResolvedValue([])
    expect(await listSegments('t1')).toEqual([])
  })

  it('maps segment with leadCount from _count', async () => {
    mockSegmentFindMany.mockResolvedValue([
      {
        id: 'seg1',
        tenantId: 't1',
        name: 'MQL Segment',
        description: null,
        criteria: {},
        createdAt: new Date('2025-01-01'),
        _count: { leads: 5 },
      },
    ])
    const [s] = await listSegments('t1')
    expect(s.leadCount).toBe(5)
    expect(s.name).toBe('MQL Segment')
    expect(s.id).toBe('seg1')
  })

  it('queries with tenantId', async () => {
    mockSegmentFindMany.mockResolvedValue([])
    await listSegments('specific-tenant')
    expect(mockSegmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'specific-tenant' } }),
    )
  })
})

// ─── createSegment ─────────────────────────────────────────────────────────────

describe('createSegment', () => {
  it('creates segment and returns it', async () => {
    const created = { id: 'seg-new', tenantId: 't1', name: 'New Seg', description: null, criteria: {} }
    mockSegmentCreate.mockResolvedValue(created)
    mockSegmentFindFirst.mockResolvedValue({ ...created })
    mockLeadFindMany.mockResolvedValue([])

    const result = await createSegment('t1', { name: 'New Seg', criteria: {} })
    expect(result).toEqual(created)
    expect(mockSegmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 't1', name: 'New Seg' }),
      }),
    )
  })

  it('calls applySegmentCriteria after create', async () => {
    const created = { id: 'seg-new', tenantId: 't1', name: 'New Seg', description: null, criteria: {} }
    mockSegmentCreate.mockResolvedValue(created)
    mockSegmentFindFirst.mockResolvedValue({ ...created })
    mockLeadFindMany.mockResolvedValue([{ id: 'l1' }])

    await createSegment('t1', { name: 'New Seg', criteria: {} })
    // deleteMany should be called (from applySegmentCriteria)
    expect(mockLeadSegDeleteMany).toHaveBeenCalled()
  })

  it('passes null description when not provided', async () => {
    const created = { id: 'seg1', tenantId: 't1', name: 'No Desc', description: null, criteria: {} }
    mockSegmentCreate.mockResolvedValue(created)
    mockSegmentFindFirst.mockResolvedValue(created)
    mockLeadFindMany.mockResolvedValue([])

    await createSegment('t1', { name: 'No Desc', criteria: {} })
    const call = mockSegmentCreate.mock.calls[0][0]
    expect(call.data.description).toBeNull()
  })
})

// ─── deleteSegment ─────────────────────────────────────────────────────────────

describe('deleteSegment', () => {
  it('deletes with correct id and tenantId', async () => {
    mockSegmentDelete.mockResolvedValue({})
    await deleteSegment('t1', 'seg1')
    expect(mockSegmentDelete).toHaveBeenCalledWith({
      where: { id: 'seg1', tenantId: 't1' },
    })
  })
})

// ─── applySegmentCriteria ──────────────────────────────────────────────────────

describe('applySegmentCriteria', () => {
  it('returns 0 when segment not found', async () => {
    mockSegmentFindFirst.mockResolvedValue(null)
    const count = await applySegmentCriteria('t1', 'seg1')
    expect(count).toBe(0)
    expect(mockLeadFindMany).not.toHaveBeenCalled()
  })

  it('returns lead count and resets existing links', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment())
    mockLeadFindMany.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }])

    const count = await applySegmentCriteria('t1', 'seg1')
    expect(count).toBe(2)
    expect(mockLeadSegDeleteMany).toHaveBeenCalledWith({ where: { segmentId: 'seg1' } })
    expect(mockLeadSegCreateMany).toHaveBeenCalledWith({
      data: [
        { leadId: 'l1', segmentId: 'seg1' },
        { leadId: 'l2', segmentId: 'seg1' },
      ],
      skipDuplicates: true,
    })
  })

  it('skips createMany when no leads match', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment())
    mockLeadFindMany.mockResolvedValue([])

    const count = await applySegmentCriteria('t1', 'seg1')
    expect(count).toBe(0)
    expect(mockLeadSegDeleteMany).toHaveBeenCalled()
    expect(mockLeadSegCreateMany).not.toHaveBeenCalled()
  })

  it('applies lifecycle filter when specified', async () => {
    mockSegmentFindFirst.mockResolvedValue(
      makeSegment({ lifecycle: ['marketingqualifiedlead', 'salesqualifiedlead'] }),
    )
    mockLeadFindMany.mockResolvedValue([])

    await applySegmentCriteria('t1', 'seg1')
    const callArgs = mockLeadFindMany.mock.calls[0][0]
    expect(callArgs.where.lifecycle).toEqual({
      in: ['marketingqualifiedlead', 'salesqualifiedlead'],
    })
  })

  it('does not include lifecycle in where when empty array', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment({ lifecycle: [] }))
    mockLeadFindMany.mockResolvedValue([])

    await applySegmentCriteria('t1', 'seg1')
    const callArgs = mockLeadFindMany.mock.calls[0][0]
    expect(callArgs.where.lifecycle).toBeUndefined()
  })

  it('applies minIcpScore filter when specified', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment({ minIcpScore: 50 }))
    mockLeadFindMany.mockResolvedValue([])

    await applySegmentCriteria('t1', 'seg1')
    const callArgs = mockLeadFindMany.mock.calls[0][0]
    expect(callArgs.where.icpScore).toEqual({ gte: 50 })
  })

  it('applies company filter with case-insensitive contains', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment({ company: '株式会社' }))
    mockLeadFindMany.mockResolvedValue([])

    await applySegmentCriteria('t1', 'seg1')
    const callArgs = mockLeadFindMany.mock.calls[0][0]
    expect(callArgs.where.company).toEqual({ contains: '株式会社', mode: 'insensitive' })
  })

  it('always includes tenantId in where clause', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment())
    mockLeadFindMany.mockResolvedValue([])

    await applySegmentCriteria('t1', 'seg1')
    const callArgs = mockLeadFindMany.mock.calls[0][0]
    expect(callArgs.where.tenantId).toBe('t1')
  })
})

// ─── getSegment ────────────────────────────────────────────────────────────────

describe('getSegment', () => {
  it('returns segment when found', async () => {
    const segment = { id: 'seg1', tenantId: 't1', name: 'High ICP', leads: [] }
    mockSegmentFindFirst.mockResolvedValue(segment)

    const result = await getSegment('t1', 'seg1')
    expect(result).toEqual(segment)
  })

  it('returns null when not found', async () => {
    mockSegmentFindFirst.mockResolvedValue(null)
    const result = await getSegment('t1', 'seg-unknown')
    expect(result).toBeNull()
  })

  it('queries with both id and tenantId', async () => {
    mockSegmentFindFirst.mockResolvedValue(null)
    await getSegment('specific-tenant', 'specific-seg')
    expect(mockSegmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'specific-seg', tenantId: 'specific-tenant' },
      }),
    )
  })

  it('includes leads with lead data', async () => {
    mockSegmentFindFirst.mockResolvedValue(null)
    await getSegment('t1', 'seg1')
    const args = mockSegmentFindFirst.mock.calls[0][0]
    expect(args.include).toBeDefined()
    expect(args.include.leads).toBeDefined()
  })
})
