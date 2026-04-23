import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    aeoCompetitor: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/modules/aeo', () => ({
  listPrompts: vi.fn(),
  createPrompt: vi.fn(),
  getPrompt: vi.fn(),
  updatePrompt: vi.fn(),
  deletePrompt: vi.fn(),
  addCompetitor: vi.fn(),
  removeCompetitor: vi.fn(),
  detectCitationGaps: vi.fn(),
  generateAndEnqueueSuggestion: vi.fn(),
  CreatePromptSchema: { safeParse: vi.fn() },
  UpdatePromptSchema: { safeParse: vi.fn() },
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import * as AeoModule from '@/modules/aeo'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockAeoCompetitorFindMany = prisma.aeoCompetitor.findMany as ReturnType<typeof vi.fn>
const mockListPrompts = AeoModule.listPrompts as ReturnType<typeof vi.fn>
const mockCreatePrompt = AeoModule.createPrompt as ReturnType<typeof vi.fn>
const mockGetPrompt = AeoModule.getPrompt as ReturnType<typeof vi.fn>
const mockUpdatePrompt = AeoModule.updatePrompt as ReturnType<typeof vi.fn>
const mockDeletePrompt = AeoModule.deletePrompt as ReturnType<typeof vi.fn>
const mockAddCompetitor = AeoModule.addCompetitor as ReturnType<typeof vi.fn>
const mockRemoveCompetitor = AeoModule.removeCompetitor as ReturnType<typeof vi.fn>
const mockDetectCitationGaps = AeoModule.detectCitationGaps as ReturnType<typeof vi.fn>
const mockGenerateAndEnqueueSuggestion = AeoModule.generateAndEnqueueSuggestion as ReturnType<typeof vi.fn>
const mockCreatePromptSchema = AeoModule.CreatePromptSchema as { safeParse: ReturnType<typeof vi.fn> }
const mockUpdatePromptSchema = AeoModule.UpdatePromptSchema as { safeParse: ReturnType<typeof vi.fn> }

function makeCtx(tenantId = 't1', ownDomain = 'example.com') {
  return { clerkId: 'clerk1', user: { id: 'u1' }, tenant: { id: tenantId, ownDomain } }
}

function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(`http://localhost${url}`, opts)
}

beforeEach(() => vi.clearAllMocks())

// ─── GET/POST /api/aeo/prompts ────────────────────────────────────────────────

import { GET as promptsGET, POST as promptsPOST } from '../prompts/route'

describe('GET /api/aeo/prompts', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await promptsGET()
    expect(res.status).toBe(401)
  })

  it('returns prompts list', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockListPrompts.mockResolvedValue([{ id: 'p1', text: 'Best CRM?' }])

    const res = await promptsGET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('p1')
  })

  it('passes tenantId to listPrompts', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockListPrompts.mockResolvedValue([])

    await promptsGET()
    expect(mockListPrompts).toHaveBeenCalledWith('specific-tenant')
  })
})

describe('POST /api/aeo/prompts', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await promptsPOST(makeRequest('/api/aeo/prompts', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockCreatePromptSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await promptsPOST(makeRequest('/api/aeo/prompts', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('creates prompt and returns 201', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const input = { text: 'Best CRM for SMB?' }
    mockCreatePromptSchema.safeParse.mockReturnValue({ success: true, data: input })
    mockCreatePrompt.mockResolvedValue({ id: 'p1', ...input })

    const res = await promptsPOST(makeRequest('/api/aeo/prompts', { method: 'POST', body: JSON.stringify(input) }))
    expect(res.status).toBe(201)
  })
})

// ─── GET/PATCH/DELETE /api/aeo/prompts/[promptId] ────────────────────────────

import { GET as promptGET, PATCH as promptPATCH, DELETE as promptDELETE } from '../prompts/[promptId]/route'

const params = { params: Promise.resolve({ promptId: 'p1' }) }

describe('GET /api/aeo/prompts/[promptId]', () => {
  it('returns 404 when prompt not found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetPrompt.mockResolvedValue(null)

    const res = await promptGET(makeRequest('/api/aeo/prompts/p1'), params)
    expect(res.status).toBe(404)
  })

  it('returns prompt when found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetPrompt.mockResolvedValue({ id: 'p1', text: 'Best CRM?' })

    const res = await promptGET(makeRequest('/api/aeo/prompts/p1'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('p1')
  })
})

describe('PATCH /api/aeo/prompts/[promptId]', () => {
  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdatePromptSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await promptPATCH(makeRequest('/api/aeo/prompts/p1', { method: 'PATCH', body: '{}' }), params)
    expect(res.status).toBe(400)
  })

  it('updates prompt successfully', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdatePromptSchema.safeParse.mockReturnValue({ success: true, data: { isActive: false } })
    mockUpdatePrompt.mockResolvedValue({ id: 'p1', isActive: false })

    const res = await promptPATCH(
      makeRequest('/api/aeo/prompts/p1', { method: 'PATCH', body: '{"isActive":false}' }),
      params,
    )
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/aeo/prompts/[promptId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await promptDELETE(makeRequest('/api/aeo/prompts/p1'), params)
    expect(res.status).toBe(401)
  })

  it('deletes prompt and returns deleted: true', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockDeletePrompt.mockResolvedValue(undefined)

    const res = await promptDELETE(makeRequest('/api/aeo/prompts/p1'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.deleted).toBe(true)
  })

  it('scopes delete to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('tenant-xyz'))
    mockDeletePrompt.mockResolvedValue(undefined)

    await promptDELETE(makeRequest('/api/aeo/prompts/p1'), params)
    expect(mockDeletePrompt).toHaveBeenCalledWith('tenant-xyz', 'p1')
  })
})

// ─── GET/POST/DELETE /api/aeo/prompts/[promptId]/competitors ─────────────────

import {
  GET as competitorsGET,
  POST as competitorsPOST,
  DELETE as competitorsDELETE,
} from '../prompts/[promptId]/competitors/route'

describe('GET /api/aeo/prompts/[promptId]/competitors', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await competitorsGET(makeRequest('/api/aeo/prompts/p1/competitors'), params)
    expect(res.status).toBe(401)
  })

  it('returns competitors scoped to tenant and prompt', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    const competitors = [{ id: 'c1', domain: 'competitor.com' }]
    mockAeoCompetitorFindMany.mockResolvedValue(competitors)

    const res = await competitorsGET(makeRequest('/api/aeo/prompts/p1/competitors'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('c1')
    expect(mockAeoCompetitorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', promptId: 'p1' }) }),
    )
  })
})

describe('POST /api/aeo/prompts/[promptId]/competitors', () => {
  it('returns 400 for invalid domain', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await competitorsPOST(
      makeRequest('/api/aeo/prompts/p1/competitors', { method: 'POST', body: '{}' }),
      params,
    )
    expect(res.status).toBe(400)
  })

  it('adds competitor and returns 201', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockAddCompetitor.mockResolvedValue({ id: 'c1', domain: 'comp.com' })

    const res = await competitorsPOST(
      makeRequest('/api/aeo/prompts/p1/competitors', {
        method: 'POST',
        body: JSON.stringify({ domain: 'comp.com' }),
      }),
      params,
    )
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/aeo/prompts/[promptId]/competitors', () => {
  it('returns 404 when prompt not found in tenant', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetPrompt.mockResolvedValue(null)

    const res = await competitorsDELETE(
      makeRequest('/api/aeo/prompts/p1/competitors', {
        method: 'DELETE',
        body: JSON.stringify({ domain: 'comp.com' }),
      }),
      params,
    )
    expect(res.status).toBe(404)
  })

  it('removes competitor and returns deleted: true', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetPrompt.mockResolvedValue({ id: 'p1' })
    mockRemoveCompetitor.mockResolvedValue(undefined)

    const res = await competitorsDELETE(
      makeRequest('/api/aeo/prompts/p1/competitors', {
        method: 'DELETE',
        body: JSON.stringify({ domain: 'comp.com' }),
      }),
      params,
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.deleted).toBe(true)
  })
})

// ─── POST /api/aeo/prompts/[promptId]/suggest ─────────────────────────────────

import { POST as suggestPOST } from '../prompts/[promptId]/suggest/route'

describe('POST /api/aeo/prompts/[promptId]/suggest', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await suggestPOST(makeRequest('/api/aeo/prompts/p1/suggest'), params)
    expect(res.status).toBe(401)
  })

  it('returns 202 with approvalItemId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockDetectCitationGaps.mockResolvedValue([{ promptId: 'p1', engine: 'CHATGPT', gapType: 'not_cited' }])
    mockGenerateAndEnqueueSuggestion.mockResolvedValue('ap1')

    const res = await suggestPOST(makeRequest('/api/aeo/prompts/p1/suggest'), params)
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.approvalItemId).toBe('ap1')
  })

  it('filters gaps to the specific promptId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const allGaps = [
      { promptId: 'p1', engine: 'CHATGPT' },
      { promptId: 'p2', engine: 'CHATGPT' }, // different prompt
    ]
    mockDetectCitationGaps.mockResolvedValue(allGaps)
    mockGenerateAndEnqueueSuggestion.mockResolvedValue('ap1')

    await suggestPOST(makeRequest('/api/aeo/prompts/p1/suggest'), params)
    expect(mockGenerateAndEnqueueSuggestion).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      [allGaps[0]], // only p1 gap
    )
  })
})
