import { describe, it, expect } from 'vitest'
import { containsTenantId, hasTenantId } from '../tenant-middleware'

// ─── containsTenantId ─────────────────────────────────────────────────────────

describe('containsTenantId', () => {
  it('returns true when tenantId is at the top level', () => {
    expect(containsTenantId({ tenantId: 't1', name: 'test' })).toBe(true)
  })

  it('returns true when tenantId is nested in composite unique key', () => {
    // upsert パターン: { tenantId_hubspotId: { tenantId: 'x', hubspotId: 'y' } }
    expect(containsTenantId({ tenantId_hubspotId: { tenantId: 't1', hubspotId: 'h1' } })).toBe(true)
  })

  it('returns true when tenantId is nested two levels deep', () => {
    expect(containsTenantId({ tenantId_text: { tenantId: 't1', text: 'keyword' } })).toBe(true)
  })

  it('returns false when tenantId is absent', () => {
    expect(containsTenantId({ propertyId: { not: '' } })).toBe(false)
  })

  it('returns false for undefined input', () => {
    expect(containsTenantId(undefined)).toBe(false)
  })

  it('returns false for empty object', () => {
    expect(containsTenantId({})).toBe(false)
  })

  it('does not recurse into arrays', () => {
    // 配列の中は再帰しない（depth 制限の確認）
    expect(containsTenantId({ items: [{ tenantId: 't1' }] } as Record<string, unknown>)).toBe(false)
  })

  it('stops recursion at depth 3', () => {
    const deep = { a: { b: { c: { d: { tenantId: 't1' } } } } } as Record<string, unknown>
    expect(containsTenantId(deep)).toBe(false)
  })
})

// ─── hasTenantId ──────────────────────────────────────────────────────────────

describe('hasTenantId', () => {
  describe('findMany / findFirst (default where branch)', () => {
    it('returns true when tenantId is in where', () => {
      expect(hasTenantId('findMany', { where: { tenantId: 't1' } })).toBe(true)
    })

    it('returns false when tenantId is absent from where', () => {
      expect(hasTenantId('findMany', { where: { propertyId: { not: '' } } })).toBe(false)
    })

    it('returns false when no where at all', () => {
      expect(hasTenantId('findMany', {})).toBe(false)
    })
  })

  describe('create', () => {
    it('returns true when tenantId is in data', () => {
      expect(hasTenantId('create', { data: { tenantId: 't1', name: 'seg' } })).toBe(true)
    })

    it('returns false when tenantId is missing from data', () => {
      expect(hasTenantId('create', { data: { name: 'no-tenant' } })).toBe(false)
    })

    it('returns false when no data', () => {
      expect(hasTenantId('create', {})).toBe(false)
    })
  })

  describe('createMany', () => {
    it('returns true when first array item has tenantId', () => {
      expect(
        hasTenantId('createMany', {
          data: [
            { tenantId: 't1', leadId: 'l1', segmentId: 's1' },
            { tenantId: 't1', leadId: 'l2', segmentId: 's1' },
          ],
        }),
      ).toBe(true)
    })

    it('returns false when array items lack tenantId', () => {
      expect(
        hasTenantId('createMany', {
          data: [{ leadId: 'l1', segmentId: 's1' }],
        }),
      ).toBe(false)
    })

    it('returns false when data is empty array', () => {
      expect(hasTenantId('createMany', { data: [] })).toBe(false)
    })
  })

  describe('upsert', () => {
    it('returns true when tenantId is in where', () => {
      expect(hasTenantId('upsert', { where: { tenantId: 't1' }, create: {}, update: {} })).toBe(true)
    })

    it('returns true when tenantId is in composite unique key inside where', () => {
      // nurtureLead.upsert({ where: { tenantId_hubspotId: { tenantId, hubspotId } } })
      expect(
        hasTenantId('upsert', {
          where: { tenantId_hubspotId: { tenantId: 't1', hubspotId: 'h1' } },
          create: { tenantId: 't1' },
          update: {},
        }),
      ).toBe(true)
    })

    it('returns true when tenantId is only in create (not where)', () => {
      expect(
        hasTenantId('upsert', {
          where: { id: 'some-id' },
          create: { tenantId: 't1', name: 'new' },
          update: { name: 'updated' },
        }),
      ).toBe(true)
    })

    it('returns false when tenantId is absent from both where and create', () => {
      expect(hasTenantId('upsert', { where: { id: 'x' }, create: { name: 'y' }, update: {} })).toBe(
        false,
      )
    })
  })

  describe('update / delete', () => {
    it('returns true when tenantId is in where for update', () => {
      expect(hasTenantId('update', { where: { tenantId: 't1', id: 'x' }, data: {} })).toBe(true)
    })

    it('returns false when tenantId is absent from where for delete', () => {
      expect(hasTenantId('delete', { where: { id: 'x' } })).toBe(false)
    })

    it('returns false when tenantId is absent for deleteMany', () => {
      expect(hasTenantId('deleteMany', { where: { segmentId: 's1' } })).toBe(false)
    })
  })
})

// ─── withTenantGuard integration ──────────────────────────────────────────────

describe('withTenantGuard (integration via function-level check)', () => {
  it('WRITE_OPS throws when tenantId is missing — simulated via hasTenantId', () => {
    // withTenantGuard 自体は Prisma client が必要なため、ガード判定ロジックを直接テスト
    const WRITE_OPS = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']
    for (const op of WRITE_OPS) {
      expect(hasTenantId(op, { where: {}, data: {} })).toBe(false)
    }
  })

  it('READ_OPS without tenantId returns false (warn-only path)', () => {
    const READ_OPS = ['findFirst', 'findMany', 'findUnique', 'count']
    for (const op of READ_OPS) {
      expect(hasTenantId(op, { where: { propertyId: 'x' } })).toBe(false)
    }
  })
})
