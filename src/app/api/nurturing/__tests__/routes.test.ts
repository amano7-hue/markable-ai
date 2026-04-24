import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    hubSpotConnection: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    nurtureEmailDraft: {
      updateMany: vi.fn(),
    },
    approvalItem: {
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/modules/nurturing', () => ({
  syncLeads: vi.fn(),
  listLeads: vi.fn(),
  listSegments: vi.fn(),
  createSegment: vi.fn(),
  getSegment: vi.fn(),
  deleteSegment: vi.fn(),
  applySegmentCriteria: vi.fn(),
  listDrafts: vi.fn(),
  generateEmailDraft: vi.fn(),
  CreateSegmentSchema: {
    safeParse: vi.fn(),
  },
  GenerateEmailSchema: {
    safeParse: vi.fn(),
  },
}))

vi.mock('@/integrations/hubspot', () => ({
  getHubSpotClient: vi.fn(),
  HubSpotHttpClient: vi.fn(),
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import * as NurturingModule from '@/modules/nurturing'
import * as HubSpotIntegration from '@/integrations/hubspot'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockHubSpotConnectionFindUnique = prisma.hubSpotConnection.findUnique as ReturnType<typeof vi.fn>
const mockHubSpotConnectionUpsert = prisma.hubSpotConnection.upsert as ReturnType<typeof vi.fn>
const mockNurtureEmailDraftUpdateMany = prisma.nurtureEmailDraft.updateMany as ReturnType<typeof vi.fn>
const mockSyncLeads = NurturingModule.syncLeads as ReturnType<typeof vi.fn>
const mockListLeads = NurturingModule.listLeads as ReturnType<typeof vi.fn>
const mockListSegments = NurturingModule.listSegments as ReturnType<typeof vi.fn>
const mockCreateSegment = NurturingModule.createSegment as ReturnType<typeof vi.fn>
const mockGetSegment = NurturingModule.getSegment as ReturnType<typeof vi.fn>
const mockDeleteSegment = NurturingModule.deleteSegment as ReturnType<typeof vi.fn>
const mockApplySegmentCriteria = NurturingModule.applySegmentCriteria as ReturnType<typeof vi.fn>
const mockListDrafts = NurturingModule.listDrafts as ReturnType<typeof vi.fn>
const mockGenerateEmailDraft = NurturingModule.generateEmailDraft as ReturnType<typeof vi.fn>
const mockCreateSegmentSchema = NurturingModule.CreateSegmentSchema as { safeParse: ReturnType<typeof vi.fn> }
const mockGenerateEmailSchema = NurturingModule.GenerateEmailSchema as { safeParse: ReturnType<typeof vi.fn> }
const mockGetHubSpotClient = HubSpotIntegration.getHubSpotClient as ReturnType<typeof vi.fn>
const MockHubSpotHttpClient = HubSpotIntegration.HubSpotHttpClient as ReturnType<typeof vi.fn>

function makeCtx(tenantId = 't1', userId = 'u1') {
  return { clerkId: 'clerk1', user: { id: userId }, tenant: { id: tenantId } }
}

function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(`http://localhost${url}`, opts)
}

beforeEach(() => vi.clearAllMocks())

// ─── POST /api/nurturing/sync ──────────────────────────────────────────────────

import { POST as syncPOST } from '../sync/route'

describe('POST /api/nurturing/sync', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await syncPOST()
    expect(res.status).toBe(401)
  })

  it('returns synced count', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockHubSpotConnectionFindUnique.mockResolvedValue(null)
    mockGetHubSpotClient.mockReturnValue({})
    mockSyncLeads.mockResolvedValue(5)

    const res = await syncPOST()
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.synced).toBe(5)
  })

  it('passes connection to getHubSpotClient', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    const connection = { apiKey: 'key', portalId: 'p1' }
    mockHubSpotConnectionFindUnique.mockResolvedValue(connection)
    mockGetHubSpotClient.mockReturnValue({})
    mockSyncLeads.mockResolvedValue(0)

    await syncPOST()
    expect(mockGetHubSpotClient).toHaveBeenCalledWith(connection)
  })

  it('passes tenantId to syncLeads', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockHubSpotConnectionFindUnique.mockResolvedValue(null)
    mockGetHubSpotClient.mockReturnValue({})
    mockSyncLeads.mockResolvedValue(0)

    await syncPOST()
    expect(mockSyncLeads).toHaveBeenCalledWith('specific-tenant', expect.anything())
  })
})

// ─── GET /api/nurturing/leads ─────────────────────────────────────────────────

import { GET as leadsGET } from '../leads/route'

describe('GET /api/nurturing/leads', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await leadsGET(makeRequest('/api/nurturing/leads'))
    expect(res.status).toBe(401)
  })

  it('returns leads', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const leads = [{ id: 'l1', email: 'test@example.com' }]
    mockListLeads.mockResolvedValue(leads)

    const res = await leadsGET(makeRequest('/api/nurturing/leads'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(leads)
  })

  it('passes lifecycle filter from query param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockListLeads.mockResolvedValue([])

    await leadsGET(makeRequest('/api/nurturing/leads?lifecycle=mql'))
    expect(mockListLeads).toHaveBeenCalledWith('t1', 'mql')
  })

  it('passes undefined when no lifecycle param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockListLeads.mockResolvedValue([])

    await leadsGET(makeRequest('/api/nurturing/leads'))
    expect(mockListLeads).toHaveBeenCalledWith('t1', undefined)
  })
})

// ─── GET /api/nurturing/segments ──────────────────────────────────────────────

import { GET as segmentsGET, POST as segmentsPOST } from '../segments/route'

describe('GET /api/nurturing/segments', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await segmentsGET()
    expect(res.status).toBe(401)
  })

  it('returns segments', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockListSegments.mockResolvedValue([{ id: 's1', name: 'MQL セグメント' }])

    const res = await segmentsGET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('s1')
  })
})

describe('POST /api/nurturing/segments', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await segmentsPOST(makeRequest('/api/nurturing/segments', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockCreateSegmentSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await segmentsPOST(
      makeRequest('/api/nurturing/segments', { method: 'POST', body: '{}' }),
    )
    expect(res.status).toBe(400)
  })

  it('creates segment and returns 201', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const input = { name: 'Test', criteria: {} }
    const created = { id: 's1', name: 'Test' }
    mockCreateSegmentSchema.safeParse.mockReturnValue({ success: true, data: input })
    mockCreateSegment.mockResolvedValue(created)

    const res = await segmentsPOST(
      makeRequest('/api/nurturing/segments', { method: 'POST', body: JSON.stringify(input) }),
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('s1')
  })
})

// ─── GET /api/nurturing/emails ────────────────────────────────────────────────

import { GET as emailsGET } from '../emails/route'

describe('GET /api/nurturing/emails', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await emailsGET(makeRequest('/api/nurturing/emails'))
    expect(res.status).toBe(401)
  })

  it('returns drafts', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockListDrafts.mockResolvedValue([{ id: 'd1', subject: 'Test' }])

    const res = await emailsGET(makeRequest('/api/nurturing/emails'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('d1')
  })

  it('passes status filter from query param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockListDrafts.mockResolvedValue([])

    await emailsGET(makeRequest('/api/nurturing/emails?status=PENDING'))
    expect(mockListDrafts).toHaveBeenCalledWith('t1', 'PENDING')
  })
})

// ─── POST /api/nurturing/emails/generate ─────────────────────────────────────

import { POST as emailsGeneratePOST } from '../emails/generate/route'

describe('POST /api/nurturing/emails/generate', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await emailsGeneratePOST(makeRequest('/api/nurturing/emails/generate', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGenerateEmailSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await emailsGeneratePOST(
      makeRequest('/api/nurturing/emails/generate', { method: 'POST', body: '{}' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 202 with draft result', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const input = { segmentId: 's1', goal: '初回接触' }
    const result = { draftId: 'd1', approvalItemId: 'a1' }
    mockGenerateEmailSchema.safeParse.mockReturnValue({ success: true, data: input })
    mockGenerateEmailDraft.mockResolvedValue(result)

    const res = await emailsGeneratePOST(
      makeRequest('/api/nurturing/emails/generate', { method: 'POST', body: JSON.stringify(input) }),
    )
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.draftId).toBe('d1')
  })
})

// ─── GET/DELETE /api/nurturing/segments/[segmentId] ───────────────────────────

import { GET as segmentGET, DELETE as segmentDELETE } from '../segments/[segmentId]/route'

const segmentParams = { params: Promise.resolve({ segmentId: 's1' }) }

describe('GET /api/nurturing/segments/[segmentId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await segmentGET(makeRequest('/api/nurturing/segments/s1'), segmentParams)
    expect(res.status).toBe(401)
  })

  it('returns 404 when segment not found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetSegment.mockResolvedValue(null)

    const res = await segmentGET(makeRequest('/api/nurturing/segments/s1'), segmentParams)
    expect(res.status).toBe(404)
  })

  it('returns segment when found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetSegment.mockResolvedValue({ id: 's1', name: 'MQL', leads: [] })

    const res = await segmentGET(makeRequest('/api/nurturing/segments/s1'), segmentParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('s1')
  })
})

describe('DELETE /api/nurturing/segments/[segmentId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await segmentDELETE(makeRequest('/api/nurturing/segments/s1'), segmentParams)
    expect(res.status).toBe(401)
  })

  it('deletes segment and returns deleted: true', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockDeleteSegment.mockResolvedValue(undefined)

    const res = await segmentDELETE(makeRequest('/api/nurturing/segments/s1'), segmentParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.deleted).toBe(true)
  })

  it('scopes delete to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('tenant-xyz'))
    mockDeleteSegment.mockResolvedValue(undefined)

    await segmentDELETE(makeRequest('/api/nurturing/segments/s1'), segmentParams)
    expect(mockDeleteSegment).toHaveBeenCalledWith('tenant-xyz', 's1')
  })
})

// ─── POST /api/nurturing/segments/[segmentId]/apply ───────────────────────────

import { POST as applyPOST } from '../segments/[segmentId]/apply/route'

describe('POST /api/nurturing/segments/[segmentId]/apply', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await applyPOST(makeRequest('/api/nurturing/segments/s1/apply'), segmentParams)
    expect(res.status).toBe(401)
  })

  it('returns applied count', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockApplySegmentCriteria.mockResolvedValue(7)

    const res = await applyPOST(makeRequest('/api/nurturing/segments/s1/apply'), segmentParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.applied).toBe(7)
  })

  it('passes tenantId and segmentId to applySegmentCriteria', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific'))
    mockApplySegmentCriteria.mockResolvedValue(0)

    await applyPOST(makeRequest('/api/nurturing/segments/s1/apply'), segmentParams)
    expect(mockApplySegmentCriteria).toHaveBeenCalledWith('t-specific', 's1')
  })
})

// ─── PATCH /api/nurturing/emails/[draftId] ───────────────────────────────────

import { PATCH as draftPATCH } from '../emails/[draftId]/route'

const draftParams = { params: Promise.resolve({ draftId: 'd1' }) }

describe('PATCH /api/nurturing/emails/[draftId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await draftPATCH(
      makeRequest('/api/nurturing/emails/d1', { method: 'PATCH', body: '{"action":"approve"}' }),
      draftParams,
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await draftPATCH(
      makeRequest('/api/nurturing/emails/d1', { method: 'PATCH', body: '{"action":"invalid"}' }),
      draftParams,
    )
    expect(res.status).toBe(400)
  })

  it('sets status APPROVED for approve action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockNurtureEmailDraftUpdateMany.mockResolvedValue({ count: 1 })

    await draftPATCH(
      makeRequest('/api/nurturing/emails/d1', { method: 'PATCH', body: '{"action":"approve"}' }),
      draftParams,
    )
    expect(mockNurtureEmailDraftUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
    )
  })

  it('sets status REJECTED for reject action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockNurtureEmailDraftUpdateMany.mockResolvedValue({ count: 1 })

    await draftPATCH(
      makeRequest('/api/nurturing/emails/d1', { method: 'PATCH', body: '{"action":"reject"}' }),
      draftParams,
    )
    expect(mockNurtureEmailDraftUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }),
    )
  })

  it('scopes update to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific'))
    mockNurtureEmailDraftUpdateMany.mockResolvedValue({ count: 1 })

    await draftPATCH(
      makeRequest('/api/nurturing/emails/d1', { method: 'PATCH', body: '{"action":"approve"}' }),
      draftParams,
    )
    expect(mockNurtureEmailDraftUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't-specific' }) }),
    )
  })
})

// ─── GET/POST /api/nurturing/connect ─────────────────────────────────────────

import { GET as connectGET, POST as connectPOST } from '../connect/route'

describe('GET /api/nurturing/connect', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await connectGET()
    expect(res.status).toBe(401)
  })

  it('returns connected: false when no connection', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockHubSpotConnectionFindUnique.mockResolvedValue(null)

    const res = await connectGET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.connected).toBe(false)
  })

  it('returns connected: true with portalId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockHubSpotConnectionFindUnique.mockResolvedValue({ portalId: '12345', updatedAt: new Date() })

    const res = await connectGET()
    const data = await res.json()
    expect(data.connected).toBe(true)
    expect(data.portalId).toBe('12345')
  })

  it('queries with tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockHubSpotConnectionFindUnique.mockResolvedValue(null)

    await connectGET()
    expect(mockHubSpotConnectionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'specific-tenant' } }),
    )
  })
})

describe('POST /api/nurturing/connect', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await connectPOST(makeRequest('/api/nurturing/connect', { method: 'POST', body: '{"apiKey":"key"}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when apiKey is missing', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await connectPOST(makeRequest('/api/nurturing/connect', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when HubSpot API key is invalid', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    MockHubSpotHttpClient.mockImplementation(function() {
      return { testConnection: vi.fn().mockRejectedValue(new Error('Unauthorized')) }
    })

    const res = await connectPOST(
      makeRequest('/api/nurturing/connect', { method: 'POST', body: '{"apiKey":"bad-key"}' }),
    )
    expect(res.status).toBe(400)
  })

  it('upserts connection on success', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    MockHubSpotHttpClient.mockImplementation(function() {
      return { testConnection: vi.fn().mockResolvedValue({ portalId: '99999' }) }
    })
    mockHubSpotConnectionUpsert.mockResolvedValue({})

    const res = await connectPOST(
      makeRequest('/api/nurturing/connect', { method: 'POST', body: '{"apiKey":"valid-key"}' }),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.connected).toBe(true)
    expect(data.portalId).toBe('99999')
    expect(mockHubSpotConnectionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    )
  })
})
