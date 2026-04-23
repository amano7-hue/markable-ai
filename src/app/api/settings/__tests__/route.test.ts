import { describe, it, expect } from 'vitest'

// Test the settings patch data transformation logic (extracted as pure function)
function buildTenantUpdateData(data: {
  name?: string
  ownDomain?: string
  serankingProjectId?: string
}) {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.ownDomain !== undefined ? { ownDomain: data.ownDomain || null } : {}),
    ...(data.serankingProjectId !== undefined
      ? { serankingProjectId: data.serankingProjectId || null }
      : {}),
  }
}

describe('settings PATCH data transformation', () => {
  it('converts empty ownDomain string to null', () => {
    const data = buildTenantUpdateData({ ownDomain: '' })
    expect(data.ownDomain).toBeNull()
  })

  it('preserves non-empty ownDomain', () => {
    const data = buildTenantUpdateData({ ownDomain: 'example.com' })
    expect(data.ownDomain).toBe('example.com')
  })

  it('converts empty serankingProjectId string to null', () => {
    const data = buildTenantUpdateData({ serankingProjectId: '' })
    expect(data.serankingProjectId).toBeNull()
  })

  it('preserves non-empty serankingProjectId', () => {
    const data = buildTenantUpdateData({ serankingProjectId: '12345' })
    expect(data.serankingProjectId).toBe('12345')
  })

  it('omits keys not provided (partial update)', () => {
    const data = buildTenantUpdateData({ name: 'Acme Corp' })
    expect(data.name).toBe('Acme Corp')
    expect('ownDomain' in data).toBe(false)
    expect('serankingProjectId' in data).toBe(false)
  })

  it('allows updating all fields at once', () => {
    const data = buildTenantUpdateData({
      name: 'Acme Corp',
      ownDomain: 'acme.com',
      serankingProjectId: '99999',
    })
    expect(data).toEqual({
      name: 'Acme Corp',
      ownDomain: 'acme.com',
      serankingProjectId: '99999',
    })
  })
})
