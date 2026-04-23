import { describe, it, expect } from 'vitest'
import { ok, err } from '../api-response'

describe('ok', () => {
  it('returns 200 by default', async () => {
    const res = ok({ foo: 'bar' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ foo: 'bar' })
  })

  it('returns specified status code', async () => {
    const res = ok({ id: 1 }, 201)
    expect(res.status).toBe(201)
  })

  it('returns 202 for accepted responses', async () => {
    const res = ok({ synced: 5 }, 202)
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.synced).toBe(5)
  })
})

describe('err', () => {
  it('returns 400 by default', async () => {
    const res = err('Bad request')
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Bad request')
  })

  it('returns specified status code', async () => {
    const res = err('Unauthorized', 401)
    expect(res.status).toBe(401)
  })

  it('returns 404 for not found', async () => {
    const res = err('Not found', 404)
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Not found')
  })

  it('wraps message in error key', async () => {
    const res = err('Something went wrong')
    const data = await res.json()
    expect('error' in data).toBe(true)
    expect(data.error).toBe('Something went wrong')
  })
})
