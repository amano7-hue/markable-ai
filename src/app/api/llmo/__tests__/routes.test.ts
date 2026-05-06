import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    llmoCompetitor: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/modules/llmo', () => ({
  listPrompts: vi.fn(),
  createPrompt: vi.fn(),
  getPrompt: vi.fn(),
  updatePrompt: vi.fn(),
  deletePrompt: vi.fn(),
  addCompetitor: vi.fn(),
  removeCompetitor: vi.fn(),
  detectCitationGaps: vi.fn(),
  generateAndEnqueueSuggestion: vi.fn(),
  getTemplates: vi.fn(),
  syncDailySnapshots: vi.fn(),
  getSnapshotsForPrompt: vi.fn(),
  CreatePromptSchema: { safeParse: vi.fn() },
  UpdatePromptSchema: { safeParse: vi.fn() },
}))

vi.mock('@/integrations/seranking', () => ({
  getSerankingClient: vi.fn(),
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import * as LlmoModule from '@/modules/llmo'
import * as SerankingIntegration from '@/integrations/seranking'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockAeoCompetitorFindMany = prisma.aeoCompetitor.findMany as ReturnType<typeof vi.fn>
const mockListPrompts = LlmoModule.listPrompts as ReturnType<typeof vi.fn>
const mockCreatePrompt = LlmoModule.createPrompt as ReturnType<typeof vi.fn>
const mockGetPrompt = LlmoModule.getPrompt as ReturnType<typeof vi.fn>
const mockUpdatePrompt = LlmoModule.updatePrompt as ReturnType<typeof vi.fn>
const mockDeletePrompt = LlmoModule.deletePrompt as ReturnType<typeof vi.fn>
const mockAddCompetitor = LlmoModule.addCompetitor as ReturnType<typeof vi.fn>
const mockRemoveCompetitor = LlmoModule.removeCompetitor as ReturnType<typeof vi.fn>
const mockDetectCitationGaps = LlmoModule.detectCitationGaps as ReturnType<typeof vi.fn>
const mockGenerateAndEnqueueSuggestion = LlmoModule.generateAndEnqueueSuggestion as ReturnType<typeof vi.fn>
const mockGetTemplates = LlmoModule.getTemplates as ReturnType<typeof vi.fn>
const mockSyncDailySnapshots = LlmoModule.syncDailySnapshots as ReturnType<typeof vi.fn>
const mockGetSnapshotsForPrompt = LlmoModule.getSnapshotsForPrompt as ReturnType<typeof vi.fn>
const mockGetSerankingClient = SerankingIntegration.getSerankingClient as ReturnType<typeof vi.fn>
const mockCreatePromptSchema = LlmoModule.CreatePromptSchema as { safeParse: ReturnType<typeof vi.fn> }
const mockUpdatePromptSchema = LlmoModule.UpdatePromptSchema as { safeParse: ReturnType<typeof vi.fn> }

function makeCtx(tenantId = 't1', ownDomain = 'example.com') {
  return { clerkId: 'clerk1', user: { id: 'u1' }, tenant: { id: tenantId, ownDomain } }
}

function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(`http://localhost${url}`, opts)
}

beforeEach(() => vi.clearAllMocks())

// ─── GET/POST /api/llmo/prompts ────────────────────────────────────────────────

import { GET as promptsGET, POST as promptsPOST } from '../prompts/route'

describe('GET /api/llmo/prompts', () => {
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

describe('POST /api/llmo/prompts', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await promptsPOST(makeRequest('/api/llmo/prompts', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockCreatePromptSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await promptsPOST(makeRequest('/api/llmo/prompts', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('creates prompt and returns 201', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const input = { text: 'Best CRM for SMB?' }
    mockCreatePromptSchema.safeParse.mockReturnValue({ success: true, data: input })
    mockCreatePrompt.mockResolvedValue({ id: 'p1', ...input })

    const res = await promptsPOST(makeRequest('/api/llmo/prompts', { method: 'POST', body: JSON.stringify(input) }))
    expect(res.status).toBe(201)
  })
})

// ─── GET/PATCH/DELETE /api/llmo/prompts/[promptId] ────────────────────────────

import { GET as promptGET, PATCH as promptPATCH, DELETE as promptDELETE } from '../prompts/[promptId]/route'

const params = { params: Promise.resolve({ promptId: 'p1' }) }

describe('GET /api/llmo/prompts/[promptId]', () => {
  it('returns 404 when prompt not found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetPrompt.mockResolvedValue(null)

    const res = await promptGET(makeRequest('/api/llmo/prompts/p1'), params)
    expect(res.status).toBe(404)
  })

  it('returns prompt when found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetPrompt.mockResolvedValue({ id: 'p1', text: 'Best CRM?' })

    const res = await promptGET(makeRequest('/api/llmo/prompts/p1'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('p1')
  })
})

describe('PATCH /api/llmo/prompts/[promptId]', () => {
  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdatePromptSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await promptPATCH(makeRequest('/api/llmo/prompts/p1', { method: 'PATCH', body: '{}' }), params)
    expect(res.status).toBe(400)
  })

  it('updates prompt successfully', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdatePromptSchema.safeParse.mockReturnValue({ success: true, data: { isActive: false } })
    mockUpdatePrompt.mockResolvedValue({ id: 'p1', isActive: false })

    const res = await promptPATCH(
      makeRequest('/api/llmo/prompts/p1', { method: 'PATCH', body: '{"isActive":false}' }),
      params,
    )
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/llmo/prompts/[promptId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await promptDELETE(makeRequest('/api/llmo/prompts/p1'), params)
    expect(res.status).toBe(401)
  })

  it('deletes prompt and returns deleted: true', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockDeletePrompt.mockResolvedValue(undefined)

    const res = await promptDELETE(makeRequest('/api/llmo/prompts/p1'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.deleted).toBe(true)
  })

  it('scopes delete to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('tenant-xyz'))
    mockDeletePrompt.mockResolvedValue(undefined)

    await promptDELETE(makeRequest('/api/llmo/prompts/p1'), params)
    expect(mockDeletePrompt).toHaveBeenCalledWith('tenant-xyz', 'p1')
  })
})

// ─── GET/POST/DELETE /api/llmo/prompts/[promptId]/competitors ─────────────────

import {
  GET as competitorsGET,
  POST as competitorsPOST,
  DELETE as competitorsDELETE,
} from '../prompts/[promptId]/competitors/route'

describe('GET /api/llmo/prompts/[promptId]/competitors', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await competitorsGET(makeRequest('/api/llmo/prompts/p1/competitors'), params)
    expect(res.status).toBe(401)
  })

  it('returns competitors scoped to tenant and prompt', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    const competitors = [{ id: 'c1', domain: 'competitor.com' }]
    mockAeoCompetitorFindMany.mockResolvedValue(competitors)

    const res = await competitorsGET(makeRequest('/api/llmo/prompts/p1/competitors'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('c1')
    expect(mockAeoCompetitorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', promptId: 'p1' }) }),
    )
  })
})

describe('POST /api/llmo/prompts/[promptId]/competitors', () => {
  it('returns 400 for invalid domain', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await competitorsPOST(
      makeRequest('/api/llmo/prompts/p1/competitors', { method: 'POST', body: '{}' }),
      params,
    )
    expect(res.status).toBe(400)
  })

  it('adds competitor and returns 201', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockAddCompetitor.mockResolvedValue({ id: 'c1', domain: 'comp.com' })

    const res = await competitorsPOST(
      makeRequest('/api/llmo/prompts/p1/competitors', {
        method: 'POST',
        body: JSON.stringify({ domain: 'comp.com' }),
      }),
      params,
    )
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/llmo/prompts/[promptId]/competitors', () => {
  it('returns 404 when prompt not found in tenant', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetPrompt.mockResolvedValue(null)

    const res = await competitorsDELETE(
      makeRequest('/api/llmo/prompts/p1/competitors', {
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
      makeRequest('/api/llmo/prompts/p1/competitors', {
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

// ─── POST /api/llmo/prompts/[promptId]/suggest ─────────────────────────────────

import { POST as suggestPOST } from '../prompts/[promptId]/suggest/route'

describe('POST /api/llmo/prompts/[promptId]/suggest', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await suggestPOST(makeRequest('/api/llmo/prompts/p1/suggest'), params)
    expect(res.status).toBe(401)
  })

  it('returns 202 with approvalItemId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockDetectCitationGaps.mockResolvedValue([{ promptId: 'p1', engine: 'CHATGPT', gapType: 'not_cited' }])
    mockGenerateAndEnqueueSuggestion.mockResolvedValue('ap1')

    const res = await suggestPOST(makeRequest('/api/llmo/prompts/p1/suggest'), params)
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

    await suggestPOST(makeRequest('/api/llmo/prompts/p1/suggest'), params)
    expect(mockGenerateAndEnqueueSuggestion).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      [allGaps[0]], // only p1 gap
    )
  })

  it('returns 500 when generateAndEnqueueSuggestion throws', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockDetectCitationGaps.mockResolvedValue([])
    mockGenerateAndEnqueueSuggestion.mockRejectedValue(new Error('Anthropic API error'))

    const res = await suggestPOST(makeRequest('/api/llmo/prompts/p1/suggest'), params)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/llmo/gaps ────────────────────────────────────────────────────────

import { GET as gapsGET } from '../gaps/route'

describe('GET /api/llmo/gaps', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await gapsGET()
    expect(res.status).toBe(401)
  })

  it('returns citation gaps', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'example.com'))
    const gaps = [{ promptId: 'p1', engine: 'CHATGPT', gapType: 'not_cited' }]
    mockDetectCitationGaps.mockResolvedValue(gaps)

    const res = await gapsGET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(gaps)
  })

  it('passes tenantId and ownDomain to detectCitationGaps', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific', 'mysite.com'))
    mockDetectCitationGaps.mockResolvedValue([])

    await gapsGET()
    expect(mockDetectCitationGaps).toHaveBeenCalledWith('t-specific', 'mysite.com')
  })
})

// ─── GET /api/llmo/templates ───────────────────────────────────────────────────

import { GET as templatesGET } from '../templates/route'

describe('GET /api/llmo/templates', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await templatesGET(makeRequest('/api/llmo/templates'))
    expect(res.status).toBe(401)
  })

  it('returns templates', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const templates = [{ id: 't1', text: 'Best CRM?' }]
    mockGetTemplates.mockReturnValue(templates)

    const res = await templatesGET(makeRequest('/api/llmo/templates'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('t1')
  })

  it('passes industry filter from query param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetTemplates.mockReturnValue([])

    await templatesGET(makeRequest('/api/llmo/templates?industry=BtoB+SaaS'))
    expect(mockGetTemplates).toHaveBeenCalledWith('BtoB SaaS')
  })

  it('passes undefined when no industry param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetTemplates.mockReturnValue([])

    await templatesGET(makeRequest('/api/llmo/templates'))
    expect(mockGetTemplates).toHaveBeenCalledWith(undefined)
  })
})

// ─── POST /api/llmo/sync ───────────────────────────────────────────────────────

import { POST as llmoSyncPOST } from '../sync/route'

describe('POST /api/llmo/sync', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await llmoSyncPOST()
    expect(res.status).toBe(401)
  })

  it('returns synced: true with 202', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetSerankingClient.mockReturnValue({})
    mockSyncDailySnapshots.mockResolvedValue(undefined)

    const res = await llmoSyncPOST()
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.synced).toBe(true)
  })

  it('passes tenantId and ownDomain to syncDailySnapshots', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific', 'mysite.com'))
    mockGetSerankingClient.mockReturnValue({})
    mockSyncDailySnapshots.mockResolvedValue(undefined)

    await llmoSyncPOST()
    expect(mockSyncDailySnapshots).toHaveBeenCalledWith(
      't-specific',
      'mysite.com',
      expect.anything(),
      expect.any(Date),
    )
  })
})

// ─── GET /api/llmo/prompts/[promptId]/snapshots ────────────────────────────────

import { GET as snapshotsGET } from '../prompts/[promptId]/snapshots/route'

describe('GET /api/llmo/prompts/[promptId]/snapshots', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await snapshotsGET(makeRequest('/api/llmo/prompts/p1/snapshots'), params)
    expect(res.status).toBe(401)
  })

  it('returns snapshots', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const snaps = [{ id: 's1', engine: 'CHATGPT', ownRank: 2 }]
    mockGetSnapshotsForPrompt.mockResolvedValue(snaps)

    const res = await snapshotsGET(makeRequest('/api/llmo/prompts/p1/snapshots'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('s1')
  })

  it('passes days param (default 30)', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockGetSnapshotsForPrompt.mockResolvedValue([])

    await snapshotsGET(makeRequest('/api/llmo/prompts/p1/snapshots'), params)
    expect(mockGetSnapshotsForPrompt).toHaveBeenCalledWith('t1', 'p1', 30)
  })

  it('parses custom days param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockGetSnapshotsForPrompt.mockResolvedValue([])

    await snapshotsGET(makeRequest('/api/llmo/prompts/p1/snapshots?days=7'), params)
    expect(mockGetSnapshotsForPrompt).toHaveBeenCalledWith('t1', 'p1', 7)
  })
})
