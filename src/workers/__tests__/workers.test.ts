import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── shared mocks ──────────────────────────────────────────────────────────────

type HandlerFn = (ctx: { step: MockStep; logger: MockLogger }) => Promise<unknown>
const { handlers } = vi.hoisted(() => ({ handlers: {} as Record<string, HandlerFn> }))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn(
      (config: { id: string }, handler: HandlerFn) => {
        handlers[config.id] = handler
        return {}
      },
    ),
  },
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    tenant: { findMany: vi.fn() },
    ga4Connection: { findMany: vi.fn() },
    gscConnection: { findMany: vi.fn(), findUnique: vi.fn() },
    hubSpotConnection: { findMany: vi.fn() },
  },
}))

vi.mock('@/modules/aeo', () => ({
  syncDailySnapshots: vi.fn(),
}))

vi.mock('@/modules/analytics', () => ({
  syncGa4Data: vi.fn(),
}))

vi.mock('@/modules/seo', () => ({
  syncGscData: vi.fn(),
}))

vi.mock('@/modules/nurturing', () => ({
  syncLeads: vi.fn(),
}))

vi.mock('@/integrations/seranking', () => ({
  getSerankingClient: vi.fn(() => ({})),
}))

vi.mock('@/integrations/gsc', () => ({
  getGscClient: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/integrations/hubspot', () => ({
  getHubSpotClient: vi.fn(() => ({})),
}))

import { prisma } from '@/lib/db/client'
import { syncDailySnapshots } from '@/modules/aeo'
import { syncGa4Data } from '@/modules/analytics'
import { syncGscData } from '@/modules/seo'
import { syncLeads } from '@/modules/nurturing'

// Import workers to register handlers
import '../sync-aeo'
import '../sync-ga4'
import '../sync-gsc'
import '../sync-hubspot'

type MockStep = { run: ReturnType<typeof vi.fn> }
type MockLogger = { info: ReturnType<typeof vi.fn> }

function makeStep(): MockStep {
  return {
    run: vi.fn((_, fn: () => unknown) => fn()),
  }
}
function makeLogger(): MockLogger {
  return { info: vi.fn() }
}

const mockTenantFindMany = prisma.tenant.findMany as ReturnType<typeof vi.fn>
const mockGa4FindMany = prisma.ga4Connection.findMany as ReturnType<typeof vi.fn>
const mockGscFindMany = prisma.gscConnection.findMany as ReturnType<typeof vi.fn>
const mockGscFindUnique = prisma.gscConnection.findUnique as ReturnType<typeof vi.fn>
const mockHubSpotFindMany = prisma.hubSpotConnection.findMany as ReturnType<typeof vi.fn>
const mockSyncSnapshots = syncDailySnapshots as ReturnType<typeof vi.fn>
const mockSyncGa4 = syncGa4Data as ReturnType<typeof vi.fn>
const mockSyncGsc = syncGscData as ReturnType<typeof vi.fn>
const mockSyncLeads = syncLeads as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

// ─── sync-aeo-daily ──────────────────────────────────────────────────────────

describe('syncAeoDaily worker', () => {
  it('returns synced count equal to number of tenants', async () => {
    mockTenantFindMany.mockResolvedValue([
      { id: 't1', ownDomain: 'https://example.com' },
      { id: 't2', ownDomain: null },
    ])
    mockSyncSnapshots.mockResolvedValue(undefined)

    const result = await handlers['sync-aeo-daily']({ step: makeStep(), logger: makeLogger() })
    expect((result as { synced: number }).synced).toBe(2)
  })

  it('calls syncDailySnapshots for each tenant', async () => {
    mockTenantFindMany.mockResolvedValue([{ id: 't1', ownDomain: 'https://example.com' }])
    mockSyncSnapshots.mockResolvedValue(undefined)

    await handlers['sync-aeo-daily']({ step: makeStep(), logger: makeLogger() })
    expect(mockSyncSnapshots).toHaveBeenCalledWith('t1', 'https://example.com', expect.anything(), expect.any(Date))
  })

  it('uses empty string when ownDomain is null', async () => {
    mockTenantFindMany.mockResolvedValue([{ id: 't1', ownDomain: null }])
    mockSyncSnapshots.mockResolvedValue(undefined)

    await handlers['sync-aeo-daily']({ step: makeStep(), logger: makeLogger() })
    expect(mockSyncSnapshots).toHaveBeenCalledWith('t1', '', expect.anything(), expect.any(Date))
  })

  it('returns synced 0 when no tenants', async () => {
    mockTenantFindMany.mockResolvedValue([])
    const result = await handlers['sync-aeo-daily']({ step: makeStep(), logger: makeLogger() })
    expect((result as { synced: number }).synced).toBe(0)
  })
})

// ─── sync-ga4-daily ──────────────────────────────────────────────────────────

describe('syncGa4Daily worker', () => {
  it('returns tenants count', async () => {
    mockGa4FindMany.mockResolvedValue([{ tenantId: 't1' }, { tenantId: 't2' }])
    mockSyncGa4.mockResolvedValue(10)

    const result = await handlers['sync-ga4-daily']({ step: makeStep(), logger: makeLogger() })
    expect((result as { tenants: number }).tenants).toBe(2)
  })

  it('calls syncGa4Data for each connection', async () => {
    mockGa4FindMany.mockResolvedValue([{ tenantId: 'specific-tenant' }])
    mockSyncGa4.mockResolvedValue(5)

    await handlers['sync-ga4-daily']({ step: makeStep(), logger: makeLogger() })
    expect(mockSyncGa4).toHaveBeenCalledWith('specific-tenant')
  })

  it('returns tenants 0 when no connections', async () => {
    mockGa4FindMany.mockResolvedValue([])
    const result = await handlers['sync-ga4-daily']({ step: makeStep(), logger: makeLogger() })
    expect((result as { tenants: number }).tenants).toBe(0)
  })
})

// ─── sync-gsc-daily ──────────────────────────────────────────────────────────

describe('syncGscDaily worker', () => {
  it('returns synced count', async () => {
    mockGscFindMany.mockResolvedValue([{ tenantId: 't1' }, { tenantId: 't2' }])
    mockGscFindUnique.mockResolvedValue({ tenantId: 't1', siteUrl: 'https://example.com' })
    mockSyncGsc.mockResolvedValue(undefined)

    const result = await handlers['sync-gsc-daily']({ step: makeStep(), logger: makeLogger() })
    expect((result as { synced: number }).synced).toBe(2)
  })

  it('calls syncGscData for each connection', async () => {
    mockGscFindMany.mockResolvedValue([{ tenantId: 't1' }])
    mockGscFindUnique.mockResolvedValue({ tenantId: 't1', siteUrl: 'https://example.com' })
    mockSyncGsc.mockResolvedValue(undefined)

    await handlers['sync-gsc-daily']({ step: makeStep(), logger: makeLogger() })
    expect(mockSyncGsc).toHaveBeenCalledWith('t1', 'https://example.com', expect.anything(), 30)
  })

  it('uses "mock" siteUrl when connection has no siteUrl', async () => {
    mockGscFindMany.mockResolvedValue([{ tenantId: 't1' }])
    mockGscFindUnique.mockResolvedValue({ tenantId: 't1', siteUrl: '' })
    mockSyncGsc.mockResolvedValue(undefined)

    await handlers['sync-gsc-daily']({ step: makeStep(), logger: makeLogger() })
    expect(mockSyncGsc).toHaveBeenCalledWith('t1', 'mock', expect.anything(), 30)
  })
})

// ─── sync-hubspot-daily ──────────────────────────────────────────────────────

describe('syncHubSpotDaily worker', () => {
  it('returns tenants and totalLeads', async () => {
    mockHubSpotFindMany.mockResolvedValue([
      { tenantId: 't1', apiKey: 'key1', portalId: 'p1' },
      { tenantId: 't2', apiKey: 'key2', portalId: 'p2' },
    ])
    mockSyncLeads.mockResolvedValueOnce(10).mockResolvedValueOnce(5)

    const result = await handlers['sync-hubspot-daily']({ step: makeStep(), logger: makeLogger() })
    expect((result as { tenants: number; totalLeads: number }).tenants).toBe(2)
    expect((result as { tenants: number; totalLeads: number }).totalLeads).toBe(15)
  })

  it('calls syncLeads for each connection', async () => {
    mockHubSpotFindMany.mockResolvedValue([{ tenantId: 'specific', apiKey: 'k', portalId: 'p' }])
    mockSyncLeads.mockResolvedValue(3)

    await handlers['sync-hubspot-daily']({ step: makeStep(), logger: makeLogger() })
    expect(mockSyncLeads).toHaveBeenCalledWith('specific', expect.anything())
  })

  it('returns 0 totalLeads when no connections', async () => {
    mockHubSpotFindMany.mockResolvedValue([])
    const result = await handlers['sync-hubspot-daily']({ step: makeStep(), logger: makeLogger() })
    expect((result as { totalLeads: number }).totalLeads).toBe(0)
  })
})
