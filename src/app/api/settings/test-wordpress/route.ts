import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { WordPressClient } from '@/integrations/wordpress/client'
import { z } from 'zod'

const Schema = z.object({
  wpUrl: z.string().url(),
  wpUsername: z.string().min(1),
  wpAppPassword: z.string().min(1),
})

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err('入力値が不正です', 400)

  const { wpUrl, wpUsername, wpAppPassword } = parsed.data

  try {
    const wp = new WordPressClient(wpUrl, wpUsername, wpAppPassword)
    const result = await wp.testConnection()
    return ok(result)
  } catch (e) {
    return err(e instanceof Error ? e.message : '接続に失敗しました', 400)
  }
}
