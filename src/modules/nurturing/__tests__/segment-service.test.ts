import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    nurtureSegment: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    nurtureLead: { findMany: vi.fn() },
    nurtureLeadSegment: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/db/client'
import { applySegmentCriteria } from '../segment-service'

const mockSegmentFindFirst = prisma.nurtureSegment.findFirst as ReturnType<typeof vi.fn>
const mockLeadFindMany = prisma.nurtureLead.findMany as ReturnType<typeof vi.fn>
const mockLeadSegDeleteMany = prisma.nurtureLeadSegment.deleteMany as ReturnType<typeof vi.fn>
const mockLeadSegCreateMany = prisma.nurtureLeadSegment.createMany as ReturnType<typeof vi.fn>

function makeSegment(criteria: object) {
  return { id: 'seg1', tenantId: 't1', criteria }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLeadSegDeleteMany.mockResolvedValue({ count: 0 })
  mockLeadSegCreateMany.mockResolvedValue({ count: 0 })
})

describe('applySegmentCriteria', () => {
  it('returns 0 when segment not found', async () => {
    mockSegmentFindFirst.mockResolvedValue(null)
    const count = await applySegmentCriteria('t1', 'seg1')
    expect(count).toBe(0)
    expect(mockLeadFindMany).not.toHaveBeenCalled()
  })

  it('returns lead count and resets existing links', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment({}))
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
    mockSegmentFindFirst.mockResolvedValue(makeSegment({}))
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
    mockSegmentFindFirst.mockResolvedValue(makeSegment({}))
    mockLeadFindMany.mockResolvedValue([])

    await applySegmentCriteria('t1', 'seg1')
    const callArgs = mockLeadFindMany.mock.calls[0][0]
    expect(callArgs.where.tenantId).toBe('t1')
  })
})
