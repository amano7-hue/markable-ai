import { describe, it, expect, vi, beforeEach } from 'vitest'

type MiddlewareHandler = (auth: () => Promise<{ userId: string | null }>, request: Request) => Promise<Response | undefined>

const { capturedHandler, capturedRoutes } = vi.hoisted(() => ({
  capturedHandler: { current: null as MiddlewareHandler | null },
  capturedRoutes: { current: [] as string[] },
}))

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: vi.fn((handler: MiddlewareHandler) => {
    capturedHandler.current = handler
    return vi.fn()
  }),
  createRouteMatcher: vi.fn((routes: string[]) => {
    capturedRoutes.current = routes
    // Simulate Clerk's pattern matching: patterns ending in (.*) match the prefix
    return (request: Request) => {
      const url = new URL(request.url)
      const path = url.pathname
      return routes.some((pattern) => {
        if (pattern.includes('(.*)')) {
          const prefix = pattern.replace('(.*)', '')
          return path === prefix || path.startsWith(prefix)
        }
        return path === pattern
      })
    }
  }),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: vi.fn((url: URL) => ({
      status: 307,
      headers: { get: (h: string) => h === 'location' ? url.toString() : null },
    })),
  },
}))

// Import proxy to register the middleware
import '../proxy'

function makeRequest(path: string) {
  return new Request(`http://localhost:3000${path}`)
}

async function runMiddleware(path: string, userId: string | null) {
  const auth = vi.fn().mockResolvedValue({ userId })
  return capturedHandler.current!(auth, makeRequest(path))
}

beforeEach(() => vi.clearAllMocks())

describe('proxy middleware', () => {
  describe('public route matching', () => {
    it('registers correct public routes', () => {
      expect(capturedRoutes.current).toContain('/')
      expect(capturedRoutes.current).toContain('/sign-in(.*)')
      expect(capturedRoutes.current).toContain('/sign-up(.*)')
      expect(capturedRoutes.current).toContain('/api/inngest(.*)')
      expect(capturedRoutes.current).toContain('/api/auth/gsc(.*)')
      expect(capturedRoutes.current).toContain('/api/auth/ga4(.*)')
    })
  })

  describe('authenticated requests', () => {
    it('allows authenticated user on protected route', async () => {
      const res = await runMiddleware('/dashboard', 'clerk-user-id')
      expect(res).toBeUndefined()
    })

    it('allows authenticated user on API route', async () => {
      const res = await runMiddleware('/api/settings', 'clerk-user-id')
      expect(res).toBeUndefined()
    })
  })

  describe('unauthenticated requests', () => {
    it('redirects unauthenticated user on protected route', async () => {
      const res = await runMiddleware('/dashboard', null)
      expect(res).not.toBeUndefined()
      expect(res!.status).toBe(307)
    })

    it('redirect URL contains /sign-in', async () => {
      const res = await runMiddleware('/dashboard/seo', null)
      const location = res!.headers.get('location')
      expect(location).toContain('/sign-in')
    })

    it('redirect URL includes redirect_url param', async () => {
      const res = await runMiddleware('/dashboard/seo', null)
      const location = res!.headers.get('location') ?? ''
      expect(location).toContain('redirect_url')
    })
  })

  describe('public routes pass through without auth check', () => {
    it('does not check auth on home page', async () => {
      const auth = vi.fn().mockResolvedValue({ userId: null })
      await capturedHandler.current!(auth, makeRequest('/'))
      expect(auth).not.toHaveBeenCalled()
    })

    it('does not check auth on sign-in page', async () => {
      const auth = vi.fn().mockResolvedValue({ userId: null })
      await capturedHandler.current!(auth, makeRequest('/sign-in'))
      expect(auth).not.toHaveBeenCalled()
    })

    it('does not check auth on inngest webhook', async () => {
      const auth = vi.fn().mockResolvedValue({ userId: null })
      await capturedHandler.current!(auth, makeRequest('/api/inngest'))
      expect(auth).not.toHaveBeenCalled()
    })

    it('does not check auth on GA4 OAuth callback', async () => {
      const auth = vi.fn().mockResolvedValue({ userId: null })
      await capturedHandler.current!(auth, makeRequest('/api/auth/ga4/callback'))
      expect(auth).not.toHaveBeenCalled()
    })

    it('does not check auth on GSC OAuth callback', async () => {
      const auth = vi.fn().mockResolvedValue({ userId: null })
      await capturedHandler.current!(auth, makeRequest('/api/auth/gsc/callback'))
      expect(auth).not.toHaveBeenCalled()
    })
  })
})
