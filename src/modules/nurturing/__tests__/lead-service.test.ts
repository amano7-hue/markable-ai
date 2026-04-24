import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    nurtureLead: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db/client'
import { calcIcpScore, syncLeads, listLeads } from '../lead-service'

const mockUpsert = prisma.nurtureLead.upsert as ReturnType<typeof vi.fn>
const mockFindMany = prisma.nurtureLead.findMany as ReturnType<typeof vi.fn>
const mockCount = prisma.nurtureLead.count as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockCount.mockResolvedValue(0)
})

// ─── calcIcpScore (pure function) ─────────────────────────────────────────────

describe('calcIcpScore', () => {
  describe('jobTitle scoring', () => {
    it('scores CxO titles as 30', () => {
      expect(calcIcpScore('CEO')).toBe(30)
      expect(calcIcpScore('CTO')).toBe(30)
      expect(calcIcpScore('CMO')).toBe(30)
      expect(calcIcpScore('Founder')).toBe(30)
      expect(calcIcpScore('President')).toBe(30)
    })

    it('scores VP/Director titles as 20', () => {
      expect(calcIcpScore('VP of Engineering')).toBe(20)
      // Note: "Vice President" matches "president" in the CxO regex → 30
      expect(calcIcpScore('Director of Marketing')).toBe(20)
    })

    it('scores Vice President as 30 (contains "president" which matches CxO regex)', () => {
      expect(calcIcpScore('Vice President Sales')).toBe(30)
    })

    it('scores Manager titles as 10', () => {
      expect(calcIcpScore('Product Manager')).toBe(10)
      expect(calcIcpScore('Marketing Manager')).toBe(10)
    })

    it('scores unknown titles as 0', () => {
      expect(calcIcpScore('Engineer')).toBe(0)
      expect(calcIcpScore('Analyst')).toBe(0)
    })

    it('is case-insensitive', () => {
      expect(calcIcpScore('ceo')).toBe(30)
      expect(calcIcpScore('CEO')).toBe(30)
    })
  })

  describe('lifecycle scoring', () => {
    it('scores SQL/opportunity as 30', () => {
      expect(calcIcpScore(null, 'salesqualifiedlead')).toBe(30)
      expect(calcIcpScore(null, 'opportunity')).toBe(30)
    })

    it('scores MQL as 20', () => {
      expect(calcIcpScore(null, 'marketingqualifiedlead')).toBe(20)
    })

    it('scores other lifecycle stages as 0', () => {
      expect(calcIcpScore(null, 'lead')).toBe(0)
      expect(calcIcpScore(null, 'customer')).toBe(0)
    })
  })

  describe('company scoring', () => {
    it('adds 10 for non-empty company', () => {
      expect(calcIcpScore(null, null, 'Acme Corp')).toBe(10)
    })

    it('adds 0 for null/undefined company', () => {
      expect(calcIcpScore(null, null, null)).toBe(0)
      expect(calcIcpScore(null, null, undefined)).toBe(0)
    })
  })

  describe('combined scoring', () => {
    it('sums all factors', () => {
      // CEO(30) + MQL(20) + company(10) = 60
      expect(calcIcpScore('CEO', 'marketingqualifiedlead', 'Acme')).toBe(60)
    })

    it('caps score at 100', () => {
      // CEO(30) + SQL(30) + company(10) = 70, under cap
      expect(calcIcpScore('CEO', 'salesqualifiedlead', 'Acme')).toBe(70)
    })

    it('returns 0 for empty lead', () => {
      expect(calcIcpScore()).toBe(0)
      expect(calcIcpScore(null, null, null)).toBe(0)
    })
  })
})

// ─── syncLeads ────────────────────────────────────────────────────────────────

describe('syncLeads', () => {
  function makeClient(contacts: object[]) {
    return { getContacts: vi.fn().mockResolvedValue(contacts) }
  }

  it('returns 0 for empty contact list', async () => {
    const count = await syncLeads('t1', makeClient([]))
    expect(count).toBe(0)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('returns contact count', async () => {
    mockUpsert.mockResolvedValue({})
    const contacts = [
      { id: 'h1', email: 'a@example.com' },
      { id: 'h2', email: 'b@example.com' },
    ]
    const count = await syncLeads('t1', makeClient(contacts))
    expect(count).toBe(2)
    expect(mockUpsert).toHaveBeenCalledTimes(2)
  })

  it('upserts with tenantId and hubspotId key', async () => {
    mockUpsert.mockResolvedValue({})
    await syncLeads('t1', makeClient([{ id: 'hs1', email: 'x@example.com' }]))
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_hubspotId: { tenantId: 't1', hubspotId: 'hs1' } },
      }),
    )
  })

  it('calculates icpScore and includes it in upsert', async () => {
    mockUpsert.mockResolvedValue({})
    await syncLeads('t1', makeClient([
      { id: 'h1', email: 'ceo@co.com', jobTitle: 'CEO', lifecycle: 'marketingqualifiedlead', company: 'ACME' },
    ]))
    const call = mockUpsert.mock.calls[0][0]
    // CEO(30) + MQL(20) + company(10) = 60
    expect(call.create.icpScore).toBe(60)
    expect(call.update.icpScore).toBe(60)
  })

  it('requests 500 contacts from client', async () => {
    const client = makeClient([])
    await syncLeads('t1', client)
    expect(client.getContacts).toHaveBeenCalledWith(500)
  })
})

// ─── listLeads ────────────────────────────────────────────────────────────────

describe('listLeads', () => {
  it('queries without lifecycle filter when not provided', async () => {
    mockFindMany.mockResolvedValue([])
    await listLeads('t1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    )
  })

  it('includes lifecycle filter when provided', async () => {
    mockFindMany.mockResolvedValue([])
    await listLeads('t1', 'marketingqualifiedlead')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1', lifecycle: 'marketingqualifiedlead' },
      }),
    )
  })

  it('orders by icpScore descending', async () => {
    mockFindMany.mockResolvedValue([])
    await listLeads('t1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { icpScore: 'desc' } }),
    )
  })

  it('returns { leads, total } shape', async () => {
    const rows = [{ id: 'l1', email: 'a@b.com' }]
    mockFindMany.mockResolvedValue(rows)
    mockCount.mockResolvedValue(42)
    const result = await listLeads('t1')
    expect(result).toEqual({ leads: rows, total: 42 })
  })

  it('applies skip/take for pagination', async () => {
    mockFindMany.mockResolvedValue([])
    await listLeads('t1', undefined, 3)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    )
  })
})
